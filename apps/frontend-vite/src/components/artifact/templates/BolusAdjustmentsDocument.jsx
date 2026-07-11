/**
 * BolusAdjustmentsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * Findings / Assessment / Plan / Notes use per-sentence split with editing.
 * date -> date-picker editable. recommendations -> object-array (date-grouped). results -> recursive OBJECT renderer.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BolusAdjustmentsPDFTemplate from '../pdf-templates/BolusAdjustmentsPDFTemplate';
import './BolusAdjustmentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [editKey]: { field, value, arrayIndex?, localKey, renderVal } } }
   - editKey   = the editedFields tracking key (e.g. "plan-0-p1", "results-0-glucose.fasting")
   - field     = DB field name to PUT (supports dotted nested paths for the results object)
   - value     = value to PUT for that field (full merged value for sentence/array/object fields)
   - arrayIndex= only when the DB write targets a single array element
   - localKey  = the localEdits key to repopulate ("field-idx", used for rendering)
   - renderVal = the value to store in localEdits[localKey] for rendering */
const DRAFT_KEY = 'bolus_adjustmentsPendingEdits';
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
  dateInfo: ['date'],
  bolusAdj: ['mealTime', 'oldRatio', 'newRatio', 'reason'],
  clinical: ['findings', 'assessment'],
  plan: ['plan'],
  results: ['results'],
  recommendations: ['recommendations'],
  providerInfo: ['provider', 'facility', 'status'],
  notes: ['notes'],
};
const FIELD_LABELS = { mealTime: 'Meal Time', oldRatio: 'Old Ratio', newRatio: 'New Ratio', reason: 'Reason for Change', findings: 'Findings', assessment: 'Assessment', plan: 'Plan', results: 'Results', recommendations: 'Recommendations', provider: 'Provider', facility: 'Facility', status: 'Status', notes: 'Notes', date: 'Date' };
const SENTENCE_FIELDS = ['findings', 'assessment', 'plan', 'notes'];

/* ═══════ PURE HELPERS ═══════ */
const humanizeKey = (key) => {
  if (key === null || key === undefined || key === '') return '';
  const s = String(key).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const isScalar = (v) => v === null || typeof v !== 'object';
const fmtScalar = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v ?? ''); };
const isEmptyDeep = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'boolean') return false;
  if (typeof v === 'number') return !Number.isFinite(v);
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter(x => !isEmptyDeep(x)).length === 0;
  if (typeof v === 'object') return Object.values(v).every(isEmptyDeep);
  return false;
};
const flattenSearchable = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  if (Array.isArray(v)) return v.map(flattenSearchable).join(' ');
  if (typeof v === 'object') return Object.entries(v).map(([k, val]) => `${humanizeKey(k)} ${flattenSearchable(val)}`).join(' ');
  return '';
};
const recsToText = (recs) => Array.isArray(recs) ? recs.map(r => `${r?.recommendation || ''} ${r?.date || ''}`).join(' ') : '';

const BolusAdjustmentsDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.bolus_adjustments) return Array.isArray(r.bolus_adjustments) ? r.bolus_adjustments : [r.bolus_adjustments]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bolus_adjustments) return Array.isArray(dd.bolus_adjustments) ? dd.bolus_adjustments : [dd.bolus_adjustments]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return String(d); return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const toInputDate = (d) => { if (!d) return ''; try { const dt = new Date(d.$date || d); if (isNaN(dt.getTime())) return ''; return dt.toISOString().split('T')[0]; } catch { return ''; } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record && record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([editKey, draft]) => {
        if (!draft || typeof draft !== 'object') return;
        // editKey was stored with the ORIGINAL record index; rebase onto the current render index.
        const dash = editKey.indexOf(`-${draft.idx}`);
        const rebasedKey = (typeof draft.idx === 'number' && dash !== -1)
          ? editKey.slice(0, dash) + `-${idx}` + editKey.slice(dash + `-${draft.idx}`.length)
          : editKey;
        const localKey = draft.localKey ? draft.localKey.replace(/-\d+$/, `-${idx}`) : null;
        if (localKey && draft.renderVal !== undefined) nLocal[localKey] = draft.renderVal;
        nPending[rebasedKey] = true;
        nFields[rebasedKey] = 'edited';
      });
    });
    if (Object.keys(nPending).length === 0) return;
    setLocalEdits(prev => ({ ...nLocal, ...prev }));
    setPendingEdits(prev => ({ ...nPending, ...prev }));
    setEditedFields(prev => ({ ...nFields, ...prev }));
  }, [records]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][ek] = { field: fn, value, localKey: ek, renderVal: value, idx };
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, [editValue]);

  const handleSaveFieldWithValue = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const ek = `${fn}-${idx}`; const trackKey = editTrackingKey || ek;
    setLocalEdits(prev => ({ ...prev, [ek]: valueOverride }));
    setPendingEdits(prev => ({ ...prev, [trackKey]: true }));
    setEditedFields(prev => ({ ...prev, [trackKey]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][trackKey] = { field: fn, value: valueOverride, localKey: ek, renderVal: valueOverride, idx };
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, []);

  /* save a nested leaf in the results OBJECT via dotted-path field — staged as a DRAFT (no DB write) */
  const saveLeaf = useCallback((record, rootField, path, idx, sid, leafKeyTrack, newVal) => {
    const rid = getRecordId(record); if (!rid) { setSaveError('No record ID'); return; }
    const dottedField = `${rootField}.${path.join('.')}`;
    const localKey = `${rootField}-${idx}`;
    let mergedClone;
    setLocalEdits(prev => {
      const cur = prev[localKey] !== undefined ? prev[localKey] : record[rootField];
      const clone = JSON.parse(JSON.stringify(cur ?? {}));
      let node = clone;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]];
      node[path[path.length - 1]] = newVal;
      mergedClone = clone;
      return { ...prev, [localKey]: clone };
    });
    setPendingEdits(prev => ({ ...prev, [leafKeyTrack]: true }));
    setEditedFields(prev => ({ ...prev, [leafKeyTrack]: 'edited' }));
    setApprovedSections(prev => { const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    // DB write replays the single dotted leaf; renderVal repopulates the merged object clone for the row.
    store[rid][leafKeyTrack] = { field: dottedField, value: newVal, localKey, renderVal: mergedClone, idx };
    // keep every leaf draft's renderVal in sync with the latest merged clone for this object root
    Object.keys(store[rid]).forEach(k => { if (store[rid][k] && store[rid][k].localKey === localKey) store[rid][k].renderVal = mergedClone; });
    writeDrafts(store);
    setEditingField(null); setEditValue(''); setSaveError(null);
  }, []);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setSaving(true); setSaveError(null);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const inSection = (dbField) => { const base = dbField.indexOf('.') === -1 ? dbField : dbField.slice(0, dbField.indexOf('.')); return sf.includes(base); };
      const store = readDrafts();
      const recDrafts = store[rid] || {};
      // Only this section's staged drafts (matched by the draft's DB field base name)
      const committedKeys = Object.keys(recDrafts).filter(k => recDrafts[k] && inSection(recDrafts[k].field));
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const k of committedKeys) {
        const d = recDrafts[k];
        const payload = { field: d.field, value: d.value };
        if (typeof d.arrayIndex === 'number') payload.arrayIndex = d.arrayIndex;
        await sc.put(`/api/edit/bolus_adjustments/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/bolus_adjustments/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending markers for the committed keys → committed values now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; committedKeys.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      committedKeys.forEach(k => delete recDrafts[k]);
      if (Object.keys(recDrafts).length === 0) delete store[rid];
      writeDrafts(store);

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BolusAdjustments] Approve failed:', err); setSaveError('Approve failed.'); }
    finally { setSaving(false); }
  }, []);

  const splitBySentence = (text) => { if (!text) return []; return text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const fieldSearchText = (f, val) => { if (f === 'recommendations') return recsToText(val); if (f === 'results') return flattenSearchable(val); return String(val ?? ''); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fieldSearchText(fn, getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Bolus Adjustment ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.mealTime, record.oldRatio, record.newRatio, record.reason, record.findings, record.assessment, record.plan, flattenSearchable(record.results), recsToText(record.recommendations), record.notes, record.provider, record.facility, record.status, ...Object.values(FIELD_LABELS), 'Bolus Adjustment', 'Clinical Assessment', 'Plan', 'Results', 'Recommendations', 'Provider Information', 'Notes'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  /* ═══════ DATE FIELD (date-picker) ═══════ */
  const renderDateField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const displayVal = formatDate(value);
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); if (isNaN(new Date(editValue).getTime())) { setSaveError('Please enter a valid date'); return; } handleSaveField(record, fn, idx, sid, editValue + 'T00:00:00.000Z'); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(value)); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(displayVal)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayVal, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && value !== false && !localEdits[`${fn}-${idx}`]) return null;
    const dv = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '');
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus rows={1} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val.trim()) return null;
    if (!shouldShowSection(record, title, [val], [fieldName])) return null;
    const sentences = splitBySentence(val);
    if (sentences.length <= 1) return renderSection(record, idx, sid, title, renderEditableField(record, fieldName, idx, sid, true));
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
      {sentences.map((sentence, si) => { if (!sa && !phraseMatch(sentence, searchTerm)) return null; const partKey = `${fieldName}-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `${sid}-${idx}-${si}`; const displayText = sentence.replace(/\.$/, ''); if (isEditing) return (<div key={si} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const parts = splitBySentence(val); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} autoFocus rows={2} disabled={saving} />{saveError && <div className="save-error">{saveError}</div>}<div className="edit-actions"><button className="save-btn" onClick={() => { const parts = splitBySentence(val); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button></div></div></div>); return (<React.Fragment key={si}><div className="rec-mini-card"><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); setSaveError(null); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div></React.Fragment>); }).filter(Boolean)}
    </div></div>);
  };

  /* ═══════ OBJECT LEAF (editable scalar within results) ═══════ */
  const renderObjectLeaf = (record, rootField, path, idx, sid, value) => {
    const leafValueString = fmtScalar(value);
    const leafKey = `${rootField}-${idx}-${path.join('.')}`;
    const isEditing = editingField === leafKey;
    const isModified = editedFields[leafKey];
    const isBool = typeof value === 'boolean';
    return (
      <div key={path[path.length - 1]} className="nested-mini-card">
        <div className="nested-subtitle sub-label">{highlightText(humanizeKey(path[path.length - 1]))}</div>
        <div className={`numbered-row editable-row${isModified ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(leafKey); setEditValue(isBool ? (value ? 'yes' : 'no') : leafValueString); setSaveError(null); } }}>
          {isEditing ? (
            <div className="edit-field-container">
              {isBool ? (
                <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }}>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : (
                <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} disabled={saving} />
              )}
              {saveError && <div className="save-error">{saveError}</div>}
              <div className="edit-actions">
                <button className="save-btn" disabled={saving} onClick={e => { e.stopPropagation(); const newVal = isBool ? editValue === 'yes' : editValue.trim(); saveLeaf(record, rootField, path, idx, sid, leafKey, newVal); }}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-content"><span className="content-value">{highlightText(leafValueString)}</span><span className="edit-indicator">✎</span></div>
              <button className={`copy-btn${copiedId === leafKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${humanizeKey(path[path.length - 1])}\n${leafValueString}`, leafKey); }}>{copiedId === leafKey ? 'Copied' : 'Copy'}</button>
            </>
          )}
        </div>
        {isModified && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div>
    );
  };

  /* ═══════ OBJECT NODE (recursive) ═══════ */
  const renderObjectNode = (record, rootField, idx, sid, label, value, path, depth) => {
    if (isEmptyDeep(value)) return null;
    if (isScalar(value)) return renderObjectLeaf(record, rootField, path, idx, sid, value);
    const entries = Object.entries(value).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    return (
      <React.Fragment key={path.join('-') || rootField}>
        {label && <div className={depth > 0 ? 'nested-subtitle sub-label' : 'nested-subtitle'}>{highlightText(label)}</div>}
        <div className="nested-group">
          {entries.map(([k, v]) => (
            isScalar(v) ? renderObjectLeaf(record, rootField, [...path, k], idx, sid, v)
              : <div className="nested-mini-card" key={k}>{renderObjectNode(record, rootField, idx, sid, humanizeKey(k), v, [...path, k], depth + 1)}</div>
          ))}
        </div>
      </React.Fragment>
    );
  };

  const renderObjectSection = (record, idx, sid, title, fn) => {
    const val = getFieldValue(record, fn, idx);
    if (isEmptyDeep(val) || isScalar(val)) return null;
    const entries = Object.entries(val).filter(([, v]) => !isEmptyDeep(v));
    if (entries.length === 0) return null;
    if (!shouldShowSection(record, title, [flattenSearchable(val)], [fn])) return null;
    return renderSection(record, idx, sid, title, (
      <div className="rec-mini-card">
        {entries.map(([k, v]) => (
          isScalar(v) ? renderObjectLeaf(record, fn, [k], idx, sid, v)
            : <div className="nested-mini-card" key={k}>{renderObjectNode(record, fn, idx, sid, humanizeKey(k), v, [k], 1)}</div>
        ))}
      </div>
    ));
  };

  /* ═══════ RECOMMENDATIONS (object-array, date-grouped) ═══════ */
  const renderRecommendationsSection = (record, idx, sid, title, fn) => {
    const val = getFieldValue(record, fn, idx);
    const recs = Array.isArray(val) ? val.filter(r => !isEmptyDeep(r)) : [];
    if (recs.length === 0) return null;
    if (!shouldShowSection(record, title, [recsToText(recs)], [fn])) return null;
    const stm = sectionTitleMatches(title);
    const phrase = searchTerm.toLowerCase().trim();
    const baseShow = !searchTerm.trim() || record._showAllSections || stm;

    const groups = [];
    recs.forEach((rec, rIdx) => { const d = (rec?.date || '').trim(); const last = groups[groups.length - 1]; if (last && last.date === d) last.items.push({ rec, rIdx }); else groups.push({ date: d, items: [{ rec, rIdx }] }); });

    return renderSection(record, idx, sid, title, (
      <div className="rec-mini-card">
        {groups.map((group, gIdx) => {
          const anyVisible = baseShow || group.date.toLowerCase().includes(phrase) || group.items.some(({ rec }) => (rec?.recommendation || '').toLowerCase().includes(phrase));
          if (searchTerm.trim() && !anyVisible) return null;
          return (
            <div key={gIdx} className="rec-mini-card" style={{ marginTop: 8 }}>
              {group.date && <div className="nested-subtitle">{highlightText(group.date)}</div>}
              {group.items.map(({ rec, rIdx }) => {
                const recText = (rec?.recommendation || '').trim();
                const recDate = (rec?.date || '').trim();
                const itemKey = `${fn}-${idx}-r${rIdx}`;
                const isEditing = editingField === itemKey;
                const badge = editedFields[itemKey];
                const itemMatches = baseShow || recText.toLowerCase().includes(phrase) || recDate.toLowerCase().includes(phrase);
                if (!itemMatches && searchTerm.trim()) return null;
                return (
                  <div key={rIdx}>
                    <div className={`numbered-row editable-row${badge ? ' modified' : ''}`} onClick={() => { if (!isEditing) { setEditingField(itemKey); setEditValue(recText); setSaveError(null); } }}>
                      {isEditing ? (
                        <div className="edit-field-container">
                          <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); setSaveError(null); } }} disabled={saving} />
                          {saveError && <div className="save-error">{saveError}</div>}
                          <div className="edit-actions">
                            <button className="save-btn" disabled={saving} onClick={e => {
                              e.stopPropagation();
                              const currentArr = Array.isArray(getFieldValue(record, fn, idx)) ? getFieldValue(record, fn, idx) : [];
                              const trimmed = editValue.trim();
                              const newArr = currentArr.map((r, i) => i === rIdx ? { ...r, recommendation: trimmed } : { ...r });
                              handleSaveFieldWithValue(record, fn, idx, sid, newArr, itemKey);
                            }}>{saving ? 'Saving...' : 'Save'}</button>
                            <button className="cancel-btn" onClick={e => { e.stopPropagation(); setEditingField(null); setEditValue(''); setSaveError(null); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="row-content"><span className="content-value">{highlightText(recText)}</span><span className="edit-indicator">✎</span></div>
                          <button className={`copy-btn${copiedId === itemKey ? ' copied' : ''}`} onClick={e => { e.stopPropagation(); copyToClipboard(`${recText}${recDate ? ` (${recDate})` : ''}`, itemKey); }}>{copiedId === itemKey ? 'Copied' : 'Copy'}</button>
                        </>
                      )}
                    </div>
                    {badge && <div className="modified-badge">edited - click Pending Approve to save</div>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    ));
  };

  // A localEdits key is "pending" (still a draft) if it is itself pending, or any tracking key
  // derived from it (sentence "-pN", recommendation "-rN", or object-leaf "-path") is pending.
  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    const isPending = (key) => pendingEdits[key] || Object.keys(pendingEdits).some(pk => pendingEdits[pk] && pk.startsWith(`${key}-`));
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (isPending(key)) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { dateInfo: 'DATE', bolusAdj: 'BOLUS ADJUSTMENT', clinical: 'CLINICAL ASSESSMENT', plan: 'PLAN', results: 'RESULTS', recommendations: 'RECOMMENDATIONS', providerInfo: 'PROVIDER INFORMATION', notes: 'NOTES' };

  const objectCopyLines = (label, value, indent) => {
    const pad = '  '.repeat(indent);
    if (isScalar(value)) return `${pad}${label}: ${fmtScalar(value)}\n`;
    let out = label ? `${pad}${label}:\n` : '';
    Object.entries(value).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { out += objectCopyLines(humanizeKey(k), v, indent + 1); });
    return out;
  };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    if (sid === 'dateInfo') { if (pr.date) text += `${formatDate(pr.date)}\n`; }
    else if (sid === 'bolusAdj') { if (pr.mealTime) text += `Meal Time: ${pr.mealTime}\n`; if (pr.oldRatio) text += `Old Ratio: ${pr.oldRatio}\n`; if (pr.newRatio) text += `New Ratio: ${pr.newRatio}\n`; if (pr.reason) text += `Reason: ${pr.reason}\n`; }
    else if (sid === 'clinical') { if (pr.findings) text += `Findings: ${pr.findings}\n`; if (pr.assessment) text += `Assessment: ${pr.assessment}\n`; }
    else if (sid === 'plan') { if (pr.plan) { splitBySentence(pr.plan).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    else if (sid === 'results') { if (!isEmptyDeep(pr.results) && !isScalar(pr.results)) { Object.entries(pr.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { text += objectCopyLines(humanizeKey(k), v, 0); }); } }
    else if (sid === 'recommendations') { if (Array.isArray(pr.recommendations)) { pr.recommendations.filter(r => !isEmptyDeep(r)).forEach((r, i) => { text += `${i + 1}. ${(r?.recommendation || '').trim()}${r?.date ? ` (${r.date})` : ''}\n`; }); } }
    else if (sid === 'providerInfo') { if (pr.provider) text += `Provider: ${pr.provider}\n`; if (pr.facility) text += `Facility: ${pr.facility}\n`; if (pr.status) text += `Status: ${pr.status}\n`; }
    else if (sid === 'notes') { if (pr.notes) { splitBySentence(pr.notes).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BOLUS ADJUSTMENTS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Bolus Adjustment ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      if (r.mealTime || r.oldRatio || r.newRatio || r.reason) { text += '\nBOLUS ADJUSTMENT\n'; if (r.mealTime) text += `Meal Time: ${r.mealTime}\n`; if (r.oldRatio) text += `Old Ratio: ${r.oldRatio}\n`; if (r.newRatio) text += `New Ratio: ${r.newRatio}\n`; if (r.reason) text += `Reason: ${r.reason}\n`; }
      if (r.findings || r.assessment) { text += '\nCLINICAL ASSESSMENT\n'; if (r.findings) text += `Findings: ${r.findings}\n`; if (r.assessment) text += `Assessment: ${r.assessment}\n`; }
      if (r.plan) { text += '\nPLAN\n'; splitBySentence(r.plan).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); }
      if (!isEmptyDeep(r.results) && !isScalar(r.results)) { text += '\nRESULTS\n'; Object.entries(r.results).filter(([, v]) => !isEmptyDeep(v)).forEach(([k, v]) => { text += objectCopyLines(humanizeKey(k), v, 0); }); }
      if (Array.isArray(r.recommendations) && r.recommendations.filter(x => !isEmptyDeep(x)).length > 0) { text += '\nRECOMMENDATIONS\n'; r.recommendations.filter(x => !isEmptyDeep(x)).forEach((rec, i) => { text += `${i + 1}. ${(rec?.recommendation || '').trim()}${rec?.date ? ` (${rec.date})` : ''}\n`; }); }
      if (r.provider || r.facility || r.status) { text += '\nPROVIDER INFORMATION\n'; if (r.provider) text += `Provider: ${r.provider}\n`; if (r.facility) text += `Facility: ${r.facility}\n`; if (r.status) text += `Status: ${r.status}\n`; }
      if (r.notes) { text += '\nNOTES\n'; splitBySentence(r.notes).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => getFieldValue(record, f, idx));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => String(getFieldValue(record, f, idx) || '')), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="bolus-adjustments-document"><header className="document-header"><h1 className="document-title">Bolus Adjustments</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="bolus-adjustments-document">
      <header className="document-header">
        <h1 className="document-title">Bolus Adjustments</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BolusAdjustmentsPDFTemplate document={pdfData} />} fileName="Bolus_Adjustments.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Bolus Adjustment ${idx + 1}`)}</h3></div>
            </div>

            {record.date && renderSection(record, idx, 'dateInfo', 'Date', renderDateField(record, 'date', idx, 'dateInfo', true))}
            {renderMultiFieldSection(record, idx, 'bolusAdj', 'Bolus Adjustment', ['mealTime', 'oldRatio', 'newRatio', 'reason'])}
            {renderSentenceSplitSection(record, idx, 'clinical', 'Clinical Assessment', 'findings')}
            {renderSentenceSplitSection(record, idx, 'clinical', 'Assessment', 'assessment')}
            {renderSentenceSplitSection(record, idx, 'plan', 'Plan', 'plan')}
            {renderObjectSection(record, idx, 'results', 'Results', 'results')}
            {renderRecommendationsSection(record, idx, 'recommendations', 'Recommendations', 'recommendations')}
            {renderMultiFieldSection(record, idx, 'providerInfo', 'Provider Information', ['provider', 'facility', 'status'])}
            {renderSentenceSplitSection(record, idx, 'notes', 'Notes', 'notes')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BolusAdjustmentsDocument;
