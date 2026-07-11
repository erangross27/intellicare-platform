/**
 * BiopsychosocialFormulationDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search with phrase matching, startsWith for titles.
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 * Nested objects (biologicalFactors, psychologicalFactors, socialFactors) with mixed string+array sub-fields.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BiopsychosocialFormulationDocumentPDFTemplate from '../pdf-templates/BiopsychosocialFormulationDocumentPDFTemplate';
import './BiopsychosocialFormulationDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Pending Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value, arrayIndex? } } }
   We store the exact API payload each save handler would have PUT, so Approve can replay it
   byte-identically — this also sidesteps the file's mixed editKey suffix conventions
   (`-idx` for fields/nested, `-idx-arrayIdx` for array items). */
const DRAFT_KEY = 'biopsychosocial_formulationPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const SECTION_FIELDS = {
  date: ['date'],
  provider: ['provider', 'facility'],
  biological: ['biologicalFactors'],
  psychological: ['psychologicalFactors'],
  social: ['socialFactors'],
  strengths: ['strengths'],
  vulnerabilities: ['vulnerabilities'],
  perpetuating: ['perpetuatingFactors'],
  protective: ['protectiveFactors'],
  formulation: ['integratedFormulation'],
  findings: ['findings'],
  assessment: ['assessment'],
  plan: ['plan'],
  recommendations: ['recommendations'],
  results: ['results'],
  notes: ['notes'],
  status: ['status'],
};
const FIELD_LABELS = { date: 'Date', provider: 'Provider', facility: 'Facility', biologicalFactors: 'Biological Factors', psychologicalFactors: 'Psychological Factors', socialFactors: 'Social Factors', strengths: 'Strengths', vulnerabilities: 'Vulnerabilities', perpetuatingFactors: 'Perpetuating Factors', protectiveFactors: 'Protective Factors', integratedFormulation: 'Integrated Formulation', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', recommendations: 'Recommendations', results: 'Results', notes: 'Notes', status: 'Status' };
const isScalar = (v) => v === null || v === undefined || typeof v !== 'object';
const isEmptyDeep = (v) => { if (v === null || v === undefined || v === '') return true; if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0; if (typeof v === 'object') return Object.values(v).every(isEmptyDeep); return false; };
const keyToLabel = (key) => key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

// Paren-aware comma splitter for the nested narrative sub-fields (Genetics, Financial Stressors,
// Social Support, Family Dynamics, Self Esteem, …). A depth-0 comma is a separator UNLESS it sits
// between two digits (1,500), immediately before a 4-digit year, or before a whole-word "and"/"or"
// (so "depression and anxiety" / "stable, and improving" stay intact). join(', ') round-trips
// losslessly. Returns [] for empty, [text] when there is nothing to split.
const splitByComma = (text) => {
  if (text === null || text === undefined) return [];
  const s = String(text); const out = []; let buf = '', depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[' || ch === '{') { depth++; buf += ch; continue; }
    if (ch === ')' || ch === ']' || ch === '}') { if (depth > 0) depth--; buf += ch; continue; }
    if (ch === ',' && depth === 0) {
      const prev = s[i - 1] || ''; const rest = s.slice(i + 1).replace(/^\s+/, ''); const next = rest[0] || '';
      if ((/\d/.test(prev) && /\d/.test(next)) || /^\d{4}\b/.test(rest) || /^(?:and|or)\b/i.test(rest)) { buf += ch; continue; }
      const t = buf.trim(); if (t) out.push(t); buf = ''; continue;
    }
    buf += ch;
  }
  const t = buf.trim(); if (t) out.push(t);
  return out;
};

const BiopsychosocialFormulationDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [editedSentences, setEditedSentences] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [approving, setApproving] = useState(false);

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.biopsychosocial_formulation) return Array.isArray(r.biopsychosocial_formulation) ? r.biopsychosocial_formulation : [r.biopsychosocial_formulation]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biopsychosocial_formulation) return Array.isArray(dd.biopsychosocial_formulation) ? dd.biopsychosocial_formulation : [dd.biopsychosocial_formulation]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, payload]) => {
        if (!payload || typeof payload !== 'object') return;
        nLocal[editKey] = payload.value;
        nPending[editKey] = true;
        nFields[editKey] = 'edited';
      });
    });
    if (Object.keys(nLocal).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };
  const safeArray = (val) => Array.isArray(val) ? val.filter(Boolean) : [];

  const flattenValues = (obj) => { if (!obj || typeof obj !== 'object') return []; const values = []; Object.entries(obj).forEach(([k, v]) => { if (k === '_id') return; values.push(keyToLabel(k)); if (Array.isArray(v)) v.forEach(item => { if (item) values.push(String(item)); }); else if (v) values.push(String(v)); }); return values; };

  // Stage a DRAFT into the pending store keyed by recordId+editKey. We persist the EXACT API payload
  // each save would have PUT (field/value/arrayIndex) so Approve replays it byte-identically.
  // No DB write here; survives refresh via localStorage; stays out of the PDF until Approve.
  const stageDraft = useCallback((record, editKey, payload, sid, idx) => {
    const rid = getRecordId(record);
    if (!rid) return;
    setLocalEdits(prev => ({ ...prev, [editKey]: payload.value }));
    setPendingEdits(prev => ({ ...prev, [editKey]: true }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending.
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][editKey] = payload;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[Biopsychosocial] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(record, ek, { field: fn, value: nv }, sid, idx);
  }, [editValue, stageDraft]);

  const handleSaveNestedField = useCallback((record, idx, parentField, dotPath, sectionId) => {
    const rid = getRecordId(record); if (!rid) { console.error('[Biopsychosocial] Cannot save — no record ID'); return; }
    const ek = `${parentField}.${dotPath}-${idx}`;
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(record, ek, { field: `${parentField}.${dotPath}`, value: editValue }, sectionId, idx);
  }, [editValue, stageDraft]);

  // Save ONE comma-item of a nested STRING sub-field: re-split the current value, replace (or delete
  // on empty) the item, rejoin with ', ' and stage the WHOLE sub-field string. Saved to the SAME
  // nested path as a plain string edit, so the backend + Approve flow are unchanged (lossless).
  const saveNestedCommaItem = useCallback((record, idx, parentField, key, itemIdx, sectionId) => {
    const ek = `${parentField}.${key}-${idx}`;
    const cur = localEdits[ek] !== undefined ? localEdits[ek] : (() => { const o = record[parentField]; return o && o[key] != null ? String(o[key]) : ''; })();
    const items = splitByComma(cur);
    const nv = editValue.trim();
    if (!nv) { if (itemIdx < items.length) items.splice(itemIdx, 1); } else { items[itemIdx] = nv; }
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(record, ek, { field: `${parentField}.${key}`, value: items.join(', ') }, sectionId, idx);
  }, [editValue, localEdits, stageDraft]);

  const handleSaveArrayItem = useCallback((record, idx, fieldName, arrayIdx, sectionId) => {
    const rid = getRecordId(record); if (!rid) { console.error('[Biopsychosocial] Cannot save — no record ID'); return; }
    const ek = `${fieldName}-${idx}-${arrayIdx}`;
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    stageDraft(record, ek, { field: fieldName, value: editValue, arrayIndex: arrayIdx }, sectionId, idx);
  }, [editValue, stageDraft]);

  // Approve = COMMIT all staged drafts for this record to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setApproving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      // Collect this section's staged editKeys: pending + tracked for one of this section's fields at this idx.
      const belongsToSection = (ek) => sf.some(f => ek.startsWith(`${f}-${idx}`) || ek.startsWith(`${f}.`));
      const toCommit = Object.keys(recDrafts).filter(ek => pendingEdits[ek] && belongsToSection(ek));
      // Persist each staged field to the DB now, replaying the exact payload the save captured.
      for (const ek of toCommit) {
        await sc.put(`/api/edit/biopsychosocial_formulation/${rid}/edit`, recDrafts[ek]);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/biopsychosocial_formulation/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this section's drafts from localStorage (now committed)
      toCommit.forEach(ek => { delete recDrafts[ek]; });
      if (Object.keys(recDrafts).length === 0) delete store[rid]; else store[rid] = recDrafts;
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[Biopsychosocial] Approve failed:', err); } finally { setApproving(false); }
  }, [pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Biopsychosocial Formulation ${idx + 1}`;
      const recText = Array.isArray(record.recommendations) ? record.recommendations.flatMap(it => isScalar(it) ? [String(it)] : Object.values(it).filter(Boolean).map(String)) : [];
      const allText = [title, formatDate(record.date), record.provider, record.facility, ...flattenValues(record.biologicalFactors), ...flattenValues(record.psychologicalFactors), ...flattenValues(record.socialFactors), ...safeArray(record.strengths), ...safeArray(record.vulnerabilities), ...safeArray(record.perpetuatingFactors), ...safeArray(record.protectiveFactors), ...recText, ...flattenValues(record.results), record.integratedFormulation, record.findings, record.assessment, record.plan, record.notes, record.status, ...Object.values(FIELD_LABELS), 'Biological Factors', 'Psychological Factors', 'Social Factors', 'Genetics', 'Medical Conditions', 'Medications', 'Neurotransmitters', 'Substance Effects', 'Cognitive Biases', 'Coping Mechanisms', 'Trauma', 'Self Esteem', 'Occupational Stress', 'Financial Stressors', 'Social Support', 'Family Dynamics', 'Housing Stability', 'Provider Information'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }} disabled={approving}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().slice(0, 10); } catch { return ''; } };

  // Editable date field with native date-picker (audit: date is a Date type, not plain text)
  const renderDateField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); if (!value && localEdits[`${fn}-${idx}`] === undefined) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek];
    const displayVal = formatDate(value); const cid = `date-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || keyToLabel(fn))}</div><div className="edit-field-container"><input type="date" className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { if (isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, undefined, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || keyToLabel(fn))}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(value)); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const dv = String(value || ''); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Render nested object section (biologicalFactors, psychologicalFactors, socialFactors) — mixed string + array sub-fields, each editable
  const renderMixedObjectSection = (record, idx, fieldName, title, obj, sid) => {
    if (!obj || typeof obj !== 'object') return null;
    const entries = Object.entries(obj).filter(([k]) => k !== '_id');
    const displayable = entries.filter(([k, v]) => { if (Array.isArray(v)) return v.filter(Boolean).length > 0; return v !== null && v !== undefined && v !== ''; });
    if (displayable.length === 0) return null;
    const contentArgs = displayable.flatMap(([k, v]) => { if (Array.isArray(v)) return [keyToLabel(k), ...v.filter(Boolean)]; return [keyToLabel(k), String(v)]; });
    if (!shouldShowSection(record, title, contentArgs, [fieldName])) return null;
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;

    return (
      <div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { let text = ''; displayable.forEach(([k, v]) => { if (Array.isArray(v)) { text += `${keyToLabel(k)}\n`; v.filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); } else { text += `${keyToLabel(k)}\n`; splitByComma(String(v)).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); } }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
        {displayable.map(([key, value], ei) => {
          if (!sa && !phraseMatch(keyToLabel(key), searchTerm) && !(Array.isArray(value) ? value.some(v => phraseMatch(v, searchTerm)) : phraseMatch(String(value), searchTerm))) return null;
          if (Array.isArray(value)) {
            const items = value.filter(Boolean);
            const nestedLabelMatch = sectionTitleMatches(keyToLabel(key));
            return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(keyToLabel(key))}</div>
              {items.map((item, ai) => {
                if (!sa && !nestedLabelMatch && !phraseMatch(item, searchTerm)) return null;
                const aKey = `${fieldName}.${key}-${idx}-${ai}`;
                const aVal = localEdits[aKey] !== undefined ? localEdits[aKey] : item;
                const aEditing = editingField === aKey;
                const aEdited = editedFields[aKey];
                const cid = `${fieldName}-${idx}-${key}-${ai}`;
                if (aEditing) return (<div key={ai} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, idx, `${fieldName}.${key}`, ai, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, idx, `${fieldName}.${key}`, ai, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
                return (<React.Fragment key={ai}><div className={`numbered-row editable-row${aEdited ? ' modified' : ''}`} onClick={() => { setEditingField(aKey); setEditValue(String(aVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(aVal))}</span>{!aEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(aVal), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{aEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
              })}
            </div>);
          } else {
            const nKey = `${fieldName}.${key}-${idx}`;
            const nVal = localEdits[nKey] !== undefined ? localEdits[nKey] : String(value);
            const nEdited = editedFields[nKey];
            const citems = splitByComma(nVal);
            // No comma → ONE editable row saving the whole sub-field (unchanged behavior).
            if (citems.length <= 1) {
              const nEditing = editingField === nKey;
              const cid = `${fieldName}-${idx}-${key}`;
              if (nEditing) return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(keyToLabel(key))}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, fieldName, key, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, fieldName, key, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
              return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(keyToLabel(key))}</div><div className={`numbered-row editable-row${nEdited ? ' modified' : ''}`} onClick={() => { setEditingField(nKey); setEditValue(nVal); }}><div className="row-content"><span className="content-value">{highlightText(nVal)}</span>{!nEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(nVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{nEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
            }
            // Comma-list → one editable row per item; per-item edits re-join losslessly into the sub-field.
            return (<div key={key} className="rec-mini-card"><div className="nested-subtitle">{highlightText(keyToLabel(key))}</div>
              {citems.map((item, ci) => {
                if (!sa && !phraseMatch(keyToLabel(key), searchTerm) && !phraseMatch(item, searchTerm)) return null;
                const cKey = `${nKey}-c${ci}`; const cEditing = editingField === cKey; const cid = `${fieldName}-${idx}-${key}-c${ci}`;
                if (cEditing) return (<div key={ci} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveNestedCommaItem(record, idx, fieldName, key, ci, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveNestedCommaItem(record, idx, fieldName, key, ci, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
                return (<React.Fragment key={ci}><div className={`numbered-row editable-row${nEdited ? ' modified' : ''}`} onClick={() => { setEditingField(cKey); setEditValue(item); }}><div className="row-content"><span className="content-value">{highlightText(item)}</span>{!nEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(item, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div></React.Fragment>);
              })}
              {nEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}
            </div>);
          }
        })}
      </div></div>
    );
  };

  // Render array section with per-item editing (strengths, vulnerabilities, etc.)
  const renderEditableArraySection = (record, idx, fieldName, title, items, sid) => {
    const safeItems = safeArray(items);
    if (safeItems.length === 0) return null;
    if (!shouldShowSection(record, title, safeItems, [fieldName])) return null;
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;

    return (
      <div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copyToClipboard(safeItems.map((item, i) => `${i + 1}. ${item}`).join('\n'), `section-${sid}-${idx}`)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
        {safeItems.map((item, ai) => {
          if (!sa && !phraseMatch(item, searchTerm)) return null;
          const aKey = `${fieldName}-${idx}-${ai}`;
          const aVal = localEdits[aKey] !== undefined ? localEdits[aKey] : item;
          const aEditing = editingField === aKey;
          const aEdited = editedFields[aKey];
          const cid = `arr-${fieldName}-${idx}-${ai}`;
          if (aEditing) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, idx, fieldName, ai, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, idx, fieldName, ai, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
          return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${aEdited ? ' modified' : ''}`} onClick={() => { setEditingField(aKey); setEditValue(String(aVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(aVal))}</span>{!aEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(aVal), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{aEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
        })}
      </div></div>
    );
  };

  // Recommendations: array of { recommendation, date } objects (per schema). Each sub-field editable via dotted path.
  const renderRecommendationsSection = (record, idx, fieldName, title, items, sid) => {
    const arr = Array.isArray(items) ? items.filter(it => !isEmptyDeep(it)) : [];
    if (arr.length === 0) return null;
    const flat = arr.flatMap(it => isScalar(it) ? [String(it)] : Object.values(it).filter(v => !isEmptyDeep(v)).map(String));
    if (!shouldShowSection(record, title, flat, [fieldName])) return null;
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    const renderSub = (rec, recIdx, key) => {
      const dotPath = `${recIdx}.${key}`;
      const ek = `${fieldName}.${dotPath}-${idx}`;
      const stored = localEdits[ek];
      const baseVal = stored !== undefined ? stored : rec[key];
      if (isEmptyDeep(baseVal)) return null;
      const dv = String(baseVal);
      if (!sa && !phraseMatch(keyToLabel(key), searchTerm) && !phraseMatch(dv, searchTerm)) return null;
      const isEditing = editingField === ek;
      const isModified = editedFields[ek];
      const cid = `rec-${idx}-${dotPath}`;
      if (isEditing) return (<div key={key} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(keyToLabel(key))}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, fieldName, dotPath, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, fieldName, dotPath, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={key} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(keyToLabel(key))}</div><div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!isModified && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
    };
    return (
      <div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copyToClipboard(arr.map((it, i) => isScalar(it) ? `${i + 1}. ${it}` : `${i + 1}. ${[it.recommendation, it.date].filter(Boolean).join(' — ')}`).join('\n'), `section-${sid}-${idx}`)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
        {arr.map((rec, ri) => {
          if (isScalar(rec)) { const aKey = `${fieldName}-${idx}-${ri}`; const aVal = localEdits[aKey] !== undefined ? localEdits[aKey] : rec; const aEditing = editingField === aKey; const aEdited = editedFields[aKey]; const cid = `recstr-${idx}-${ri}`; if (!sa && !phraseMatch(String(aVal), searchTerm)) return null; if (aEditing) return (<div key={ri} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, idx, fieldName, ri, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, idx, fieldName, ri, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>); return (<div key={ri} className="rec-mini-card"><div className={`numbered-row editable-row${aEdited ? ' modified' : ''}`} onClick={() => { setEditingField(aKey); setEditValue(String(aVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(aVal))}</span>{!aEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(aVal), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{aEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>); }
          const keys = Object.keys(rec).filter(k => k !== '_id' && !isEmptyDeep(rec[k]));
          return (<div className="rec-mini-card" key={ri}>{keys.map(k => renderSub(rec, ri, k))}</div>);
        })}
      </div></div>
    );
  };

  // Recursive editable leaf inside a nested object (results). dotPath joined with '.', saved via handleSaveNestedField.
  const renderResultsLeaf = (record, idx, rootField, path, sid) => {
    const dotPath = path.join('.');
    const ek = `${rootField}.${dotPath}-${idx}`;
    const stored = localEdits[ek];
    const baseVal = stored !== undefined ? stored : path.reduce((o, k) => (o == null ? o : o[k]), record[rootField]);
    if (isEmptyDeep(baseVal)) return null;
    const dv = String(baseVal);
    const isEditing = editingField === ek;
    const isModified = editedFields[ek];
    const cid = `results-leaf-${idx}-${dotPath}`;
    const lbl = keyToLabel(path[path.length - 1]);
    if (isEditing) return (<div key={ek} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(lbl)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveNestedField(record, idx, rootField, dotPath, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveNestedField(record, idx, rootField, dotPath, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ek} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(lbl)}</div><div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!isModified && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // Recursive editable array item inside a nested object (results). Saved via handleSaveArrayItem with dotted fieldName.
  const renderResultsArrayItem = (record, idx, rootField, path, arrayIdx, sid, item) => {
    const fieldName = `${rootField}.${path.join('.')}`;
    const aKey = `${fieldName}-${idx}-${arrayIdx}`;
    const aVal = localEdits[aKey] !== undefined ? localEdits[aKey] : item;
    const aEditing = editingField === aKey;
    const aEdited = editedFields[aKey];
    const cid = `results-arr-${idx}-${path.join('.')}-${arrayIdx}`;
    if (aEditing) return (<div key={arrayIdx} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, idx, fieldName, arrayIdx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, idx, fieldName, arrayIdx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
    return (<React.Fragment key={arrayIdx}><div className={`numbered-row editable-row${aEdited ? ' modified' : ''}`} onClick={() => { setEditingField(aKey); setEditValue(String(aVal)); }}><div className="row-content"><span className="content-value">{highlightText(String(aVal))}</span>{!aEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(String(aVal), cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{aEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  // Recursive node: scalar -> leaf, array -> per-item, object -> nested-group of children. Hide-empty at every level.
  const renderResultsNode = (record, idx, rootField, label, value, path, sid, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderResultsLeaf(record, idx, rootField, path, sid);
    if (Array.isArray(value)) {
      const items = value.map((it, i) => ({ it, i })).filter(({ it }) => !isEmptyDeep(it));
      if (items.length === 0) return null;
      return (<div key={path.join('-') || rootField} className="nested-mini-card"><div className="nested-subtitle sub-label">{highlightText(label)}</div>{items.map(({ it, i }) => isScalar(it) ? renderResultsArrayItem(record, idx, rootField, path, i, sid, it) : <div className="nested-mini-card" key={i}>{renderResultsNode(record, idx, rootField, `${label} ${i + 1}`, it, [...path, String(i)], sid, depth + 1)}</div>)}</div>);
    }
    const entries = Object.entries(value).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (<React.Fragment key={path.join('-') || rootField}>{label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}<div className="nested-group">{entries.map(([k, v]) => isScalar(v) ? renderResultsLeaf(record, idx, rootField, [...path, k], sid) : <div className="nested-mini-card" key={k}>{renderResultsNode(record, idx, rootField, keyToLabel(k), v, [...path, k], sid, depth + 1)}</div>)}</div></React.Fragment>);
  };

  // Top-level results object section
  const renderResultsSection = (record, idx, fieldName, title, obj, sid) => {
    if (isEmptyDeep(obj) || isScalar(obj)) return null;
    const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && !isEmptyDeep(v));
    if (entries.length === 0) return null;
    const contentArgs = flattenValues(obj);
    if (!shouldShowSection(record, title, contentArgs, [fieldName])) return null;
    return (
      <div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { const lines = []; const walk = (v, prefix) => { if (isEmptyDeep(v)) return; if (isScalar(v)) { lines.push(`${prefix}${v}`); return; } if (Array.isArray(v)) { v.filter(x => !isEmptyDeep(x)).forEach((x, i) => walk(x, `${prefix}${i + 1}. `)); return; } Object.entries(v).filter(([k]) => k !== '_id').forEach(([k, vv]) => { if (isScalar(vv)) lines.push(`${keyToLabel(k)}: ${vv}`); else { lines.push(keyToLabel(k)); walk(vv, '  '); } }); }; walk(obj, ''); copyToClipboard(lines.join('\n'), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
        {entries.map(([k, v]) => isScalar(v) ? renderResultsLeaf(record, idx, fieldName, [k], sid) : <div className="rec-mini-card" key={k}>{renderResultsNode(record, idx, fieldName, keyToLabel(k), v, [k], sid, 1)}</div>)}
      </div></div>
    );
  };

  // Deep-clone + set value at dot/array path (e.g. "results.foo.bar", "recommendations.0.date", "strengths.2")
  const deepSet = (obj, pathStr, val) => {
    const parts = pathStr.split('.');
    const root = Array.isArray(obj) ? [...obj] : { ...obj };
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i]; const nk = parts[i + 1]; const wantArr = /^\d+$/.test(nk);
      const existing = cur[k];
      cur[k] = Array.isArray(existing) ? [...existing] : (existing && typeof existing === 'object' ? { ...existing } : (wantArr ? [] : {}));
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = val;
    return root;
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      let m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10);
        if (ri !== idx) return;
        if (fn.includes('.')) { m = deepSet(m, fn, localEdits[key]); }
        else if (fn in record) { m[fn] = localEdits[key]; }
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const copyAllContent = () => {
    let text = '=== BIOPSYCHOSOCIAL FORMULATION ===\n\n';
    pdfData.forEach((r, idx) => {
      if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n';
      text += `Biopsychosocial Formulation ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      if (r.provider) text += `${r.provider}\n`;
      if (r.facility) text += `${r.facility}\n`;
      text += '\n';
      const renderObj = (title, obj) => { if (!obj) return; const entries = Object.entries(obj).filter(([k, v]) => k !== '_id' && v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)); if (entries.length === 0) return; text += `${title.toUpperCase()}\n`; entries.forEach(([k, v]) => { text += `${keyToLabel(k)}\n`; if (Array.isArray(v)) v.filter(Boolean).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); else splitByComma(String(v)).forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }); text += '\n'; };
      renderObj('Biological Factors', r.biologicalFactors);
      renderObj('Psychological Factors', r.psychologicalFactors);
      renderObj('Social Factors', r.socialFactors);
      [['Strengths', r.strengths], ['Vulnerabilities', r.vulnerabilities], ['Perpetuating Factors', r.perpetuatingFactors], ['Protective Factors', r.protectiveFactors]].forEach(([t, arr]) => { const sa = safeArray(arr); if (sa.length > 0) { text += `${t.toUpperCase()}\n`; sa.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); text += '\n'; } });
      const recs = Array.isArray(r.recommendations) ? r.recommendations.filter(x => !isEmptyDeep(x)) : []; if (recs.length > 0) { text += `RECOMMENDATIONS\n`; recs.forEach((it, i) => { text += `${i + 1}. ${isScalar(it) ? it : [it.recommendation, it.date].filter(Boolean).join(' — ')}\n`; }); text += '\n'; }
      if (!isEmptyDeep(r.results)) { text += `RESULTS\n`; const walk = (v, prefix) => { if (isEmptyDeep(v)) return; if (isScalar(v)) { text += `${prefix}${v}\n`; return; } if (Array.isArray(v)) { v.filter(x => !isEmptyDeep(x)).forEach((x, i) => walk(x, `${prefix}${i + 1}. `)); return; } Object.entries(v).filter(([k]) => k !== '_id').forEach(([k, vv]) => { if (isScalar(vv)) text += `${keyToLabel(k)}: ${vv}\n`; else { text += `${keyToLabel(k)}\n`; walk(vv, '  '); } }); }; walk(r.results, ''); text += '\n'; }
      ['integratedFormulation', 'findings', 'assessment', 'plan', 'notes', 'status'].forEach(f => { if (r[f]) { text += `${FIELD_LABELS[f].toUpperCase()}\n1. ${r[f]}\n\n`; } });
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => { const fs = SECTION_FIELDS[sid] || []; let text = ''; fs.forEach(f => { const v = pdfData[idx]?.[f]; if (v) text += `${v}\n`; }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); }}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="biopsychosocial-formulation-document"><header className="document-header"><h1 className="document-title">Biopsychosocial Formulation</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="biopsychosocial-formulation-document">
      <header className="document-header">
        <h1 className="document-title">Biopsychosocial Formulation</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BiopsychosocialFormulationDocumentPDFTemplate document={pdfData} />} fileName="Biopsychosocial_Formulation.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{record.date && <span className="record-date">{highlightText(formatDate(record.date))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Biopsychosocial Formulation ${idx + 1}`)}</h3></div>
            </div>

            {/* Date (editable date-picker) */}
            {record.date && shouldShowSection(record, 'Date', [formatDate(record.date)], ['date']) && renderSection(record, idx, 'date', 'Date', renderDateField(record, 'date', idx, 'date'))}

            {/* Provider */}
            {(record.provider || record.facility) && shouldShowSection(record, 'Provider Information', [record.provider, record.facility].filter(Boolean), ['provider', 'facility']) && renderSection(record, idx, 'provider', 'Provider Information', (() => { const stm = sectionTitleMatches('Provider Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{(sa || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'provider')}{(sa || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'provider')}</>; })())}

            {/* Biological Factors */}
            {renderMixedObjectSection(record, idx, 'biologicalFactors', 'Biological Factors', record.biologicalFactors, 'biological')}

            {/* Psychological Factors */}
            {renderMixedObjectSection(record, idx, 'psychologicalFactors', 'Psychological Factors', record.psychologicalFactors, 'psychological')}

            {/* Social Factors */}
            {renderMixedObjectSection(record, idx, 'socialFactors', 'Social Factors', record.socialFactors, 'social')}

            {/* Strengths */}
            {renderEditableArraySection(record, idx, 'strengths', 'Strengths', record.strengths, 'strengths')}

            {/* Vulnerabilities */}
            {renderEditableArraySection(record, idx, 'vulnerabilities', 'Vulnerabilities', record.vulnerabilities, 'vulnerabilities')}

            {/* Perpetuating Factors */}
            {renderEditableArraySection(record, idx, 'perpetuatingFactors', 'Perpetuating Factors', record.perpetuatingFactors, 'perpetuating')}

            {/* Protective Factors */}
            {renderEditableArraySection(record, idx, 'protectiveFactors', 'Protective Factors', record.protectiveFactors, 'protective')}

            {/* Integrated Formulation */}
            {record.integratedFormulation && shouldShowSection(record, 'Integrated Formulation', [record.integratedFormulation], ['integratedFormulation']) && renderSection(record, idx, 'formulation', 'Integrated Formulation', renderEditableField(record, 'integratedFormulation', idx, 'formulation', true))}

            {/* Findings */}
            {record.findings && shouldShowSection(record, 'Findings', [record.findings], ['findings']) && renderSection(record, idx, 'findings', 'Findings', renderEditableField(record, 'findings', idx, 'findings', true))}

            {/* Assessment */}
            {record.assessment && shouldShowSection(record, 'Assessment', [record.assessment], ['assessment']) && renderSection(record, idx, 'assessment', 'Assessment', renderEditableField(record, 'assessment', idx, 'assessment', true))}

            {/* Plan */}
            {record.plan && shouldShowSection(record, 'Plan', [record.plan], ['plan']) && renderSection(record, idx, 'plan', 'Plan', renderEditableField(record, 'plan', idx, 'plan', true))}

            {/* Recommendations */}
            {renderRecommendationsSection(record, idx, 'recommendations', 'Recommendations', record.recommendations, 'recommendations')}

            {/* Results */}
            {renderResultsSection(record, idx, 'results', 'Results', record.results, 'results')}

            {/* Notes */}
            {record.notes && shouldShowSection(record, 'Notes', [record.notes], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderEditableField(record, 'notes', idx, 'notes', true))}

            {/* Status */}
            {record.status && shouldShowSection(record, 'Status', [record.status], ['status']) && renderSection(record, idx, 'status', 'Status', renderEditableField(record, 'status', idx, 'status', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BiopsychosocialFormulationDocument;
