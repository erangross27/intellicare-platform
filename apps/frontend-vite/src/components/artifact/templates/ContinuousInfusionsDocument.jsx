/**
 * ContinuousInfusionsDocument.jsx
 * March 2026 — Blue glow editing theme
 * Collection: continuous_infusions
 */
import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ContinuousInfusionsDocumentPDFTemplate from '../pdf-templates/ContinuousInfusionsDocumentPDFTemplate';
import BlueDatePicker from '../components/BlueDatePicker';
import BlueTimePicker from '../components/BlueTimePicker';
import secureApiClient from '../../../services/secureApiClient';
import './ContinuousInfusionsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = the localEdits field key, e.g. "vitalSigns" or "recommendations") */
const DRAFT_KEY = 'continuous_infusionsPendingEdits';
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
  assessment: 'Assessment Info',
  vitalsResponse: 'Vital Signs & Response',
  interventions: 'Interventions',
  plan: 'Plan',
  recommendations: 'Recommendations',
};

const FIELD_LABELS = {
  assessmentDate: 'Assessment Date', assessmentTime: 'Assessment Time', clinicalStatus: 'Clinical Status',
  vitalSigns: 'Vital Signs', response: 'Response',
  interventions: 'Interventions',
  plan: 'Plan',
  recommendations: 'Recommendations',
};

const SECTION_FIELDS = {
  assessment: ['assessmentDate', 'assessmentTime', 'clinicalStatus'],
  vitalsResponse: ['vitalSigns', 'response'],
  interventions: ['interventions'],
  plan: ['plan'],
  recommendations: ['recommendations'],
};

const SENTENCE_FIELDS = ['vitalSigns', 'interventions', 'response', 'plan'];
const DATE_FIELDS = ['assessmentDate'];
const TIME_FIELDS = ['assessmentTime'];

const parseLabel = (text) => { if (!text || typeof text !== 'string') return null; const m = text.match(/^([A-Za-z][A-Za-z\s/&(),.#≥≤><%0-9-]{2,}?):\s+(.*)/); return m ? { label: m[1].trim(), content: m[2].trim() } : null; };

const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);

const ContinuousInfusionsDocument = ({ document: docProp }) => {
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

  const records = useMemo(() => {
    if (!docProp) return [];
    let arr = Array.isArray(docProp) ? docProp : [docProp];
    arr = arr.flatMap(r => {
      if (r?.continuous_infusions) return Array.isArray(r.continuous_infusions) ? r.continuous_infusions : [r.continuous_infusions];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.continuous_infusions) return Array.isArray(dd.continuous_infusions) ? dd.continuous_infusions : [dd.continuous_infusions]; return [dd]; }
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

  const hasVal = useCallback((v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; }, []);
  const formatDate = useCallback((d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } }, []);
  const formatDateInput = useCallback((d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); return dt.toISOString().split('T')[0]; } catch { return ''; } }, []);
  const fmtVal = useCallback((v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); }, []);
  // Canonical: splits on BOTH '.' and ';' with the abbreviation+decimal guard ("0.25 mcg" never breaks).
  const splitBySentence = useCallback((text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Rev|Gen|Col|Sgt|vs|etc|approx|no|No|i\.e|e\.g))[;.](?:\s+)/).map(s => s.replace(/[;.]+$/, '').trim()).filter(s => s && !/^[;.,!?]+$/.test(s)); }, []);
  function reconstructFullText(sentences) { if (!sentences || sentences.length === 0) return ''; return sentences.map((s, i) => { let c = s.replace(/[;.]+$/, '').trim(); if (i < sentences.length - 1) c += '.'; return c; }).join(' '); }
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getEffectiveArray = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) { const v = localEdits[k]; return Array.isArray(v) ? v : [v]; } return Array.isArray(record[fn]) ? record[fn] : []; }, [localEdits]);
  const safeId = useCallback((r) => { if (!r?._id) return null; if (typeof r._id === 'string') return r._id; if (r._id.$oid) return r._id.$oid; return String(r._id); }, []);
  const highlightText = useCallback((text) => { if (!searchTerm.trim() || !text) return text; const phrase = searchTerm.trim(); const regex = new RegExp(`(${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'); const parts = String(text).split(regex); return parts.map((part, i) => regex.test(part) ? <mark key={i}>{part}</mark> : part); }, [searchTerm]);

  // paren-aware; keep Oxford ", and/or X"; skip no-space commas ("$18,000") and date commas ("January 8, 2026").
  const splitByComma = useCallback((text) => {
    if (!text || typeof text !== 'string') return [];
    const parts = []; let cur = ''; let depth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) {
        const rest = text.slice(i + 1);
        if (!/^\s/.test(rest)) { cur += ch; continue; }
        if (/^\s+(?:and|or)\b/i.test(rest)) { cur += ch; continue; }
        if (/\d\s*$/.test(cur) && /^\s*\d{4}\b/.test(rest)) { cur += ch; continue; }
        const t = cur.trim(); if (t) parts.push(t); cur = '';
      } else cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts.filter(Boolean);
  }, []);

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
      if (Array.isArray(val)) { if (val.some(item => { const s = typeof item === 'object' ? JSON.stringify(item) : String(item); return s.toLowerCase().includes(phrase); })) return true; }
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
    if (Array.isArray(val)) return val.some(item => { const s = typeof item === 'object' ? JSON.stringify(item) : String(item); return s.toLowerCase().includes(phrase); });
    return val !== null && val !== undefined && fmtVal(val).toLowerCase().includes(phrase);
  }, [searchTerm, getFieldValue, fmtVal]);

  const sectionTitleMatches = useCallback((sid) => { if (!searchTerm.trim()) return false; const p = searchTerm.toLowerCase().trim(); const t = (SECTION_TITLES[sid] || '').toLowerCase(); return t.includes(p) || p.includes(t); }, [searchTerm]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const phrase = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      record._showAllSections = false;
      const rt = `Continuous Infusions ${idx + 1}`.toLowerCase();
      if (rt.includes(phrase) || phrase.includes(rt)) { record._showAllSections = true; return true; }
      for (const t of Object.values(SECTION_TITLES)) { if (t.toLowerCase().includes(phrase) || phrase.includes(t.toLowerCase())) return true; }
      for (const l of Object.values(FIELD_LABELS)) { if (l.toLowerCase().includes(phrase) || phrase.includes(l.toLowerCase())) return true; }
      for (const f of Object.keys(FIELD_LABELS)) {
        const val = record[f];
        if (Array.isArray(val)) { if (val.some(item => { const s = typeof item === 'object' ? JSON.stringify(item) : String(item); return s.toLowerCase().includes(phrase); })) return true; }
        else if (val !== null && val !== undefined) { if (fmtVal(val).toLowerCase().includes(phrase)) return true; }
      }
      return false;
    });
  }, [records, searchTerm, fmtVal]);

  const pdfData = useMemo(() => filteredRecords.map((r, idx) => { const m = { ...r }; Object.keys(localEdits).forEach(k => { if (pendingEdits[k]) return; const mt = k.match(/^(.+)-(\d+)$/); if (mt && parseInt(mt[2]) === idx) m[mt[1]] = localEdits[k]; }); return m; }), [filteredRecords, localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, _arrayIndex, overrideVal) => {
    const id = safeId(record); if (!id) return;
    const sourceVal = overrideVal !== undefined ? overrideVal : editValue;
    if (DATE_FIELDS.includes(fn)) {
      if (sourceVal && isNaN(new Date(sourceVal).getTime())) { setSaveError('Please enter a valid date'); return; }
    }
    setSaveError(null);
    const saveVal = DATE_FIELDS.includes(fn) ? new Date(sourceVal).toISOString() : sourceVal;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: saveVal }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[id]) store[id] = {};
    store[id][fn] = saveVal;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, safeId]);

  // Save one sentence = stage a DRAFT locally (no DB write). localStorage keeps it across refresh; Approve commits it.
  function stageSentenceDraft(record, fn, idx, sid, fullText, sentenceIdx, newSentences, sentences) {
    const id = safeId(record); if (!id) return;
    const editKey = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: fullText }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    if (newSentences) {
      const orig = sentences[sentenceIdx] || ''; const changed = newSentences[0].replace(/[;.]+$/, '').trim() !== orig.replace(/[;.]+$/, '').trim();
      setEditedSentences(prev => { const n = { ...prev }; if (changed) n[`${fn}-${idx}-s${sentenceIdx}`] = 'edited'; const extra = newSentences.length - 1; for (let ei = 0; ei < extra; ei++) n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; return n; });
    } else {
      setEditedFields(prev => ({ ...prev, [editKey]: 'edited' }));
    }
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store);
    setEditingField(null); setEditValue('');
  }

  function saveSentence(record, fn, idx, sid, sentenceIdx) {
    const id = safeId(record); if (!id) return;
    const currentVal = String(getFieldValue(record, fn, idx) || ''); const sentences = splitBySentence(currentVal); const editedVal = editValue.trim();
    if (!editedVal || /^[;.,!?]+$/.test(editedVal)) { const updated = [...sentences]; updated.splice(sentenceIdx, 1); const fullText = reconstructFullText(updated); stageSentenceDraft(record, fn, idx, sid, fullText); return; }
    const newSentences = splitBySentence(editedVal); const updated = [...sentences]; updated.splice(sentenceIdx, 1, ...newSentences); const fullText = reconstructFullText(updated);
    stageSentenceDraft(record, fn, idx, sid, fullText, sentenceIdx, newSentences, sentences);
  }

  const sectionHasEdits = useCallback((idx, sid) => { const fields = SECTION_FIELDS[sid] || []; return fields.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); }, [editedFields, editedSentences]);
  // Approve = COMMIT this section's staged drafts for this record to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, sid, idx) => {
    const id = safeId(record); if (!id) return;
    setSaving(true);
    try {
      const fields = SECTION_FIELDS[sid] || [];
      // localEdits keys for this section+record that are still staged drafts. Key = "<fieldPart>-<idx>".
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && fields.includes(k.slice(0, -suffix.length).split('.')[0]));
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const trailing = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(trailing, 10);
        const resp = await secureApiClient.put(`/api/edit/continuous_infusions/${id}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await secureApiClient.put(`/api/edit/continuous_infusions/${id}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[id]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[id][fp]; }); if (Object.keys(store[id]).length === 0) delete store[id]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { fields.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }, [safeId, localEdits, pendingEdits]);
  const renderApproveButton = useCallback((record, sid, idx) => { const hasEdits = sectionHasEdits(idx, sid); const isApproved = approvedSections[`${sid}-${idx}`]; if (hasEdits) return (<button className="approve-btn pending" onClick={e => { e.stopPropagation(); handleApproveSection(record, sid, idx); }}>Pending Approve</button>); if (isApproved) return <span className="approve-btn approved">Approved</span>; return null; }, [sectionHasEdits, approvedSections, handleApproveSection]);

  const copyToClipboard = useCallback(async (text) => { try { await navigator.clipboard.writeText(text); return true; } catch { const ta = window.document.createElement('textarea'); ta.value = text; ta.style.position = 'absolute'; ta.style.left = '-9999px'; (containerRef.current || window.document.body).appendChild(ta); ta.select(); window.document.execCommand('copy'); (containerRef.current || window.document.body).removeChild(ta); return true; } }, []);
  const copySection = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedSection(id); setTimeout(() => setCopiedSection(null), 2000); } }, [copyToClipboard]);
  const copyItem = useCallback(async (text, id) => { const ok = await copyToClipboard(text); if (ok) { setCopiedItems(prev => ({ ...prev, [id]: true })); setTimeout(() => setCopiedItems(prev => ({ ...prev, [id]: false })), 2000); } }, [copyToClipboard]);

  // Shared EQ/DASH numbered builder — mirrors the JSX exactly (4-area rule):
  // labeled >=3 → sub-label + numbered rows (count restarts); labeled <3 → sub-label + "1. content";
  // unlabeled >=3 → numbered part rows (count continues); unlabeled <3 → whole sentence row;
  // recommendations date-grouped (date sub-label, count restarts per group). '' when empty.
  const buildSectionCopyText = useCallback((record, idx, sid) => {
    const title = SECTION_TITLES[sid];
    const lines = [];
    (SECTION_FIELDS[sid] || []).forEach(f => {
      const label = FIELD_LABELS[f] || f;
      const sameTitle = label.trim().toLowerCase() === (title || '').trim().toLowerCase();
      const val = getFieldValue(record, f, idx);
      if (f === 'recommendations') {
        const arr = getEffectiveArray(record, f, idx);
        if (arr.length === 0) return;
        const groups = {}; const order = [];
        arr.forEach(item => {
          const recText = typeof item === 'object' ? (item.recommendation || '') : String(item);
          const recDate = typeof item === 'object' && item.date ? formatDate(item.date) : '';
          const dk = recDate || 'No Date';
          if (!groups[dk]) { groups[dk] = []; order.push(dk); }
          groups[dk].push(recText);
        });
        order.forEach(dk => {
          lines.push(dk, COPY_LINE_DASH);
          let n = 0;
          groups[dk].forEach(rec => {
            const p = parseLabel(rec);
            if (p) { lines.push(p.label, COPY_LINE_DASH, `1. ${p.content}`); n = 0; }
            else lines.push(`${++n}. ${rec}`);
          });
          lines.push('');
        });
      } else if (!hasVal(val)) {
        return;
      } else if (SENTENCE_FIELDS.includes(f)) {
        if (!sameTitle) lines.push(label, COPY_LINE_DASH);
        let n = 0;
        splitBySentence(fmtVal(val)).forEach(s => {
          const p = parseLabel(s);
          if (p) {
            const ci = splitByComma(p.content);
            lines.push(p.label, COPY_LINE_DASH); n = 0;
            if (ci.length >= 3) ci.forEach(c => lines.push(`${++n}. ${c}`));
            else lines.push(`${++n}. ${p.content}`);
          } else {
            const ci = splitByComma(s);
            if (ci.length >= 3) ci.forEach(c => lines.push(`${++n}. ${c}`));
            else lines.push(`${++n}. ${s}`);
          }
        });
        lines.push('');
      } else if (DATE_FIELDS.includes(f)) {
        lines.push(label, COPY_LINE_DASH, `1. ${formatDate(val)}`, '');
      } else {
        lines.push(label, COPY_LINE_DASH, `1. ${fmtVal(val)}`, '');
      }
    });
    if (lines.length === 0) return '';
    return `${title}\n${COPY_LINE_EQ}\n\n${lines.join('\n')}\n`;
  }, [getFieldValue, getEffectiveArray, hasVal, fmtVal, splitBySentence, splitByComma, formatDate]);

  const copyAllText = useCallback(async () => {
    let text = '=== CONTINUOUS INFUSIONS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Continuous Infusions ${idx + 1}\n${COPY_LINE_EQ}\n\n`;
      Object.keys(SECTION_FIELDS).forEach(sid => { const block = buildSectionCopyText(r, idx, sid); if (block) text += `${block}\n`; });
      text += '\n';
    });
    const ok = await copyToClipboard(text); if (ok) { setShowCopied(true); setTimeout(() => setShowCopied(false), 2000); }
  }, [pdfData, copyToClipboard, buildSectionCopyText]);

  const renderEditableField = (record, fn, idx, sid, title) => {
    const val = getFieldValue(record, fn, idx); if (!hasVal(val)) return null;
    const editKey = `${fn}-${idx}`; const isEditing = editingField === editKey; const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase(); const isModified = editedFields[editKey];
    if (searchTerm.trim() && !fieldMatches(record, fn, idx) && !sectionTitleMatches(sid)) return null;
    const isDate = DATE_FIELDS.includes(fn);
    const isTime = TIME_FIELDS.includes(fn);
    const displayVal = isDate ? formatDate(val) : fmtVal(val);
    // For time fields, extract HH:MM from "14:45 PM" or similar
    const toTimeInputVal = (v) => { if (!v) return ''; const m = String(v).match(/(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
    return (<div key={fn} className={sl ? 'rec-mini-card' : ''}>{sl && <div className="nested-subtitle">{highlightText(label)}</div>}<div className={`numbered-row ${isModified ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setSaveError(null); setEditingField(editKey); setEditValue(isDate ? formatDateInput(val) : isTime ? toTimeInputVal(val) : fmtVal(val)); } }}>{isEditing ? (<div className="edit-field-container">{isDate ? (<BlueDatePicker value={editValue} onSelect={iso => setEditValue(iso)} />) : isTime ? (<BlueTimePicker value={editValue} onChange={hm => setEditValue(hm)} />) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} />)}{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isTime) { if (!/^\d{2}:\d{2}$/.test(editValue)) { setSaveError('Please pick a valid time'); return; } handleSaveField(record, fn, idx, sid, undefined, editValue); } else { handleSaveField(record, fn, idx, sid); } }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[editKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(`${label}\n${displayVal}`, editKey); }}>{copiedItems[editKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{isModified && <span className="modified-badge">edited - click Pending Approve to save</span>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, title) => {
    const val = String(getFieldValue(record, fn, idx) || ''); if (!val.trim()) return null;
    const sentences = splitBySentence(val); if (sentences.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const sl = label.toLowerCase() !== (title || '').toLowerCase();
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, fn, idx)) return null;
    const labelMatch = searchTerm.trim() && label.toLowerCase().includes(searchTerm.toLowerCase().trim());
    return (<div key={fn}><div className="rec-mini-card">{sl && <div className="nested-subtitle">{highlightText(label)}</div>}{sentences.map((sentence, sIdx) => {
      const sentenceKey = `${fn}-${idx}-s${sIdx}`; const isEditing = editingField === sentenceKey; const badge = editedSentences[sentenceKey];
      const sentenceMatches = phraseMatch || labelMatch || (searchTerm.trim() && sentence.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      if (!sentenceMatches && searchTerm.trim()) return null;
      const parsed = parseLabel(sentence);
      if (parsed) {
        const commaItems = splitByComma(parsed.content);
        if (commaItems.length >= 3) {
          return (<div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
            <div className="nested-subtitle">{highlightText(parsed.label)}</div>
            {commaItems.map((ci, ciIdx) => {
              const commaKey = `${sentenceKey}-c${ciIdx}`;
              const ciEditing = editingField === commaKey;
              const ciBadge = editedFields[commaKey];
              return (<div key={ciIdx}>
                <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setSaveError(null); setEditingField(commaKey); setEditValue(ci); } }}>
                  {ciEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || '')); const items = splitByComma(parsed.content); items[ciIdx] = editValue.trim(); curSentences[sIdx] = `${parsed.label}: ${items.join(', ')}`; const fullText = reconstructFullText(curSentences); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' })); setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                  ) : (<><div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button></>)}
                </div>
                {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
              </div>);
            })}
          </div>);
        }
        return (<div key={sIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
          <div className="nested-subtitle">{highlightText(parsed.label)}</div>
          <div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>
            {isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>
            ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed.content)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}
          </div>
          {badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}
        </div>);
      }
      /* UNLABELED sentence with a genuine (>=3) comma list — e.g. Duane's 5-drip vitalSigns —
         renders one editable row per item; save splices the item and rebuilds the sentence. */
      const plainItems = splitByComma(sentence);
      if (plainItems.length >= 3) {
        return (<div key={sIdx}>
          {plainItems.map((ci, ciIdx) => {
            const commaKey = `${sentenceKey}-c${ciIdx}`;
            const ciEditing = editingField === commaKey;
            const ciBadge = editedFields[commaKey];
            return (<div key={ciIdx}>
              <div className={`numbered-row ${ciBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!ciEditing) { setSaveError(null); setEditingField(commaKey); setEditValue(ci); } }}>
                {ciEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const curSentences = splitBySentence(String(getFieldValue(record, fn, idx) || '')); const items = splitByComma(curSentences[sIdx] || ''); const t = editValue.trim(); if (t) items[ciIdx] = t; else items.splice(ciIdx, 1); curSentences[sIdx] = items.join(', '); const fullText = reconstructFullText(curSentences.filter(Boolean)); setLocalEdits(prev => ({ ...prev, [`${fn}-${idx}`]: fullText })); setPendingEdits(prev => ({ ...prev, [`${fn}-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [commaKey]: 'edited' })); setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id][fn] = fullText; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
                ) : (<><div className="row-content"><span className="content-value">{highlightText(ci)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[commaKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(ci, commaKey); }}>{copiedItems[commaKey] ? 'Copied!' : 'Copy'}</button></>)}
              </div>
              {ciBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
            </div>);
          })}
        </div>);
      }
      return (<div key={sIdx}><div className={`numbered-row ${badge ? 'modified' : ''} editable-row`} onClick={() => { if (!isEditing) { setEditingField(sentenceKey); setEditValue(sentence.replace(/[;.]+$/, '').trim()); } }}>{isEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); saveSentence(record, fn, idx, sid, sIdx); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (<><div className="row-content"><span className="content-value">{highlightText(sentence)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[sentenceKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(sentence, sentenceKey); }}>{copiedItems[sentenceKey] ? 'Copied!' : 'Copy'}</button></>)}</div>{badge && <span className={`modified-badge ${badge === 'added' ? 'added' : ''}`}>{badge === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</span>}</div>);
    })}</div></div>);
  };

  const renderRecommendations = (record, idx, sid) => {
    const arr = getEffectiveArray(record, 'recommendations', idx); if (arr.length === 0) return null;
    const phraseMatch = !searchTerm.trim() || sectionTitleMatches(sid);
    if (searchTerm.trim() && !phraseMatch && !fieldMatches(record, 'recommendations', idx)) return null;

    // Group recommendations by date — if same date, show date once as nested-subtitle
    const groups = [];
    arr.forEach((item, ai) => {
      const recDate = typeof item === 'object' ? (item.date || '') : '';
      const dateKey = formatDate(recDate) || 'No Date';
      let group = groups.find(g => g.dateKey === dateKey);
      if (!group) { group = { dateKey, rawDate: recDate, items: [] }; groups.push(group); }
      group.items.push({ item, ai });
    });

    return groups.map((group, gi) => (
      <div key={gi} className="rec-mini-card" style={{ marginTop: gi > 0 ? 8 : 0 }}>
        {group.rawDate && <div className="nested-subtitle">{highlightText(group.dateKey)}</div>}
        {group.items.map(({ item, ai }) => {
          const recText = typeof item === 'object' ? (item.recommendation || '') : String(item);
          const recEditKey = `recommendations-${idx}-ai${ai}-rec`;
          const recEditing = editingField === recEditKey;
          const recBadge = editedFields[recEditKey];
          const itemMatches = phraseMatch || (searchTerm.trim() && recText.toLowerCase().includes(searchTerm.toLowerCase().trim()));
          if (!itemMatches && searchTerm.trim()) return null;
          const parsed = parseLabel(recText);
          return (<div key={ai} className={parsed ? 'rec-mini-card' : ''}>
            {parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}
            <div className={`numbered-row ${recBadge ? 'modified' : ''} editable-row`} onClick={() => { if (!recEditing) { setSaveError(null); setEditingField(recEditKey); setEditValue(parsed ? parsed.content : recText); } }}>
              {recEditing ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const id = safeId(record); if (!id) return; const saveText = parsed ? `${parsed.label}: ${editValue}` : editValue; const a = [...getEffectiveArray(record, 'recommendations', idx)]; a[ai] = { ...a[ai], recommendation: saveText }; setLocalEdits(prev => ({ ...prev, [`recommendations-${idx}`]: a })); setPendingEdits(prev => ({ ...prev, [`recommendations-${idx}`]: true })); setEditedFields(prev => ({ ...prev, [recEditKey]: 'edited' })); setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; }); const store = readDrafts(); if (!store[id]) store[id] = {}; store[id].recommendations = a; writeDrafts(store); setEditingField(null); setEditValue(''); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div>
              ) : (<><div className="row-content"><span className="content-value">{highlightText(parsed ? parsed.content : recText)}</span><span className="edit-indicator">✎</span></div><button className={`copy-btn ${copiedItems[recEditKey] ? 'copied' : ''}`} onClick={e => { e.stopPropagation(); copyItem(recText, recEditKey); }}>{copiedItems[recEditKey] ? 'Copied!' : 'Copy'}</button></>)}
            </div>
            {recBadge && <span className="modified-badge">edited - click Pending Approve to save</span>}
          </div>);
        })}
      </div>
    ));
  };

  const renderMixedSection = (record, idx, sid) => {
    const title = SECTION_TITLES[sid]; if (!shouldShowSection(record, sid)) return null;
    const fields = SECTION_FIELDS[sid] || [];
    const hasAnyVal = fields.some(f => {
      if (f === 'recommendations') return getEffectiveArray(record, f, idx).length > 0;
      return hasVal(getFieldValue(record, f, idx));
    }); if (!hasAnyVal) return null;
    const copyId = `${sid}-${idx}`;
    return (<div key={sid} className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn ${copiedSection === copyId ? 'copied' : ''}`} onClick={() => copySection(buildSectionCopyText(record, idx, sid), copyId)}>{copiedSection === copyId ? 'Copied!' : 'Copy Section'}</button>{renderApproveButton(record, sid, idx)}</div></div>{fields.map(f => {
      if (f === 'recommendations') return <React.Fragment key={f}>{renderRecommendations(record, idx, sid)}</React.Fragment>;
      if (SENTENCE_FIELDS.includes(f)) return renderSentenceEditableField(record, f, idx, sid, title);
      return renderEditableField(record, f, idx, sid, title);
    })}</div></div>);
  };

  if (!records || records.length === 0) return (<div className="continuous-infusions-document" ref={containerRef}><div className="document-header"><h2 className="document-title">Continuous Infusions</h2></div><div className="empty-state">No continuous infusion records available</div></div>);

  return (
    <div className="continuous-infusions-document" ref={containerRef}>
      <div className="document-header">
        <h2 className="document-title">Continuous Infusions</h2>
        <div className="header-actions">
          <button className={`copy-btn ${showCopied ? 'copied' : ''}`} onClick={copyAllText}>{showCopied ? 'Copied!' : 'Copy All'}</button>
          <PDFDownloadLink document={<ContinuousInfusionsDocumentPDFTemplate document={pdfData} />} fileName="Continuous_Infusions.pdf" className="copy-btn">
            {({ loading }) => loading ? 'Generating...' : 'Export PDF'}
          </PDFDownloadLink>
        </div>
      </div>
      <div className="search-container"><input type="text" className="search-input" placeholder="Search continuous infusions..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />{searchTerm && <span className="search-results">Showing {filteredRecords.length} of {records.length} records</span>}</div>
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header"><h3 className="record-name">{highlightText(`Continuous Infusions ${idx + 1}`)}</h3></div>
            {renderMixedSection(record, idx, 'assessment')}
            {renderMixedSection(record, idx, 'vitalsResponse')}
            {renderMixedSection(record, idx, 'interventions')}
            {renderMixedSection(record, idx, 'plan')}
            {renderMixedSection(record, idx, 'recommendations')}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContinuousInfusionsDocument;
