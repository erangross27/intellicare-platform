/**
 * BiologicTherapyDocument.jsx
 * Flat biologic_therapy collection (medication, indication, dose, route, frequency, response,
 * monitoring labs, narratives). Distinct from the nested biologic_therapy_records template.
 * Inline editing with per-section approve, per-row copy, PDFDownloadLink + pdfData memo,
 * secureApiClient for all API calls.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BiologicTherapyDocumentPDFTemplate from '../pdf-templates/BiologicTherapyDocumentPDFTemplate';
import './BiologicTherapyDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldName]: value } } */
const DRAFT_KEY = 'biologic_therapyPendingEdits';
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
  recordInfo: ['provider', 'facility'],
  medication: ['medicationName', 'indication', 'dose', 'route', 'frequency', 'startDate'],
  clinical: ['response', 'priorAuthorization'],
  monitoring: ['monitoringLabs', 'baselineAssessment'],
  safety: ['sideEffects', 'infusionReactions'],
  plan: ['continuationPlan'],
  notes: ['notes'],
};
const SECTION_TITLES = {
  recordInfo: 'Record Information', medication: 'Medication', clinical: 'Clinical Response',
  monitoring: 'Monitoring', safety: 'Side Effects & Reactions', plan: 'Continuation Plan', notes: 'Notes',
};
const FIELD_LABELS = {
  provider: 'Provider', facility: 'Facility',
  medicationName: 'Medication Name', indication: 'Indication', dose: 'Dose', route: 'Route', frequency: 'Frequency', startDate: 'Start Date',
  response: 'Response', priorAuthorization: 'Prior Authorization',
  monitoringLabs: 'Monitoring Labs', baselineAssessment: 'Baseline Assessment',
  sideEffects: 'Side Effects', infusionReactions: 'Infusion Reactions',
  continuationPlan: 'Continuation Plan', notes: 'Notes',
};
const DATE_FIELDS = ['startDate'];
const ARRAY_FIELDS = ['monitoringLabs'];
const SENTENCE_FIELDS = ['priorAuthorization', 'baselineAssessment', 'sideEffects', 'infusionReactions', 'continuationPlan', 'notes'];
const toInputDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toISOString().split('T')[0]; } catch { return ''; } };
// A single sentence "Label: value" → {isLabeled,label,value}. ':\s+' (space after colon) avoids matching
// times/ratios; the {1,80} cap stops a long sentence with a deep colon from false-matching.
const parseLabel = (s) => { if (!s || typeof s !== 'string') return { isLabeled: false, label: '', value: s || '' }; const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: s }; };
// "90mg" → edit ONLY the number with a stepper, keep the unit fixed; reassemble on save (lossless).
// Returns null for prose, and for any value whose unit holds a digit (ranges like "140-180 mg/dL")
// so the user can only increase/decrease a clean numeric measurement. (splitNumberUnit pattern, memory 6a4099a6.)
const splitNumberUnit = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([<>≤≥=~]*)\s*(-?\d+(?:\.\d+)?)(\s*)(\S.*)?$/);
  if (!m) return null;
  const unit = (m[4] || '').trim();
  if (/\d/.test(unit)) return null;
  const decimals = (m[2].split('.')[1] || '').length;
  return { prefix: m[1] || '', number: m[2], sep: m[3] || '', unit, step: decimals > 0 ? Math.pow(10, -decimals) : 1 };
};

const BiologicTherapyDocument = ({ document: rawDoc }) => {
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

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.biologic_therapy) return Array.isArray(r.biologic_therapy) ? r.biologic_therapy : [r.biologic_therapy]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.biologic_therapy) return Array.isArray(dd.biologic_therapy) ? dd.biologic_therapy : [dd.biologic_therapy]; return [dd]; } return r; });
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

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  // Abbreviation-safe: do NOT split after Dr./Mr./St./etc. (so "Dr. Thomas Park, Gastroenterology" stays one unit in Copy).
  const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+/).filter(s => { const t = s.trim(); return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BiologicTherapy] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: nv }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = nv;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record/section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setSaving(true);
    try {
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && sf.includes(k.slice(0, -suffix.length)));
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length);
        await sc.put(`/api/edit/biologic_therapy/${rid}/edit`, { field: fieldPart, value: localEdits[editKey] });
      }
      await sc.put(`/api/edit/biologic_therapy/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { delete store[rid][k.slice(0, -suffix.length)]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BiologicTherapy] Approve failed:', err); } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  function reconstructFullText(ss) { return ss.map((s, i) => { const t = s.trim(); if (i < ss.length - 1 && !t.match(/[.!?;]$/)) return t + '.'; return t; }).join(' '); }
  function saveSentence(record, fn, idx, sid, sIdx, newText) {
    const cur = String(getFieldValue(record, fn, idx) || ''); const cs = splitBySentence(cur);
    const cn = newText.trim(); const co = (cs[sIdx] || '').trim().replace(/[.!?;]+$/, '');
    if (cn === co) { setEditingField(null); setEditValue(''); return; }
    if (!cn || cn.replace(/[.!?;,]+/g, '').trim() === '') { cs.splice(sIdx, 1); setEditedSentences(prev => { const next = { ...prev }; Object.keys(next).forEach(k => { const m = k.match(new RegExp(`^${fn}-${idx}-s(\\d+)`)); if (m && parseInt(m[1], 10) >= sIdx) delete next[k]; }); return next; }); handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`); return; }
    let nt = cn; if (nt && !nt.match(/[.!?;]$/)) nt += '.'; cs[sIdx] = nt;
    const ec = nt.split(/(?<=[.!?])\s+/).length - 1;
    setEditedSentences(prev => { const n = { ...prev, [`${fn}-${idx}-s${sIdx}`]: 'edited' }; for (let e = 1; e <= ec; e++) n[`${fn}-${idx}-s${sIdx + e}`] = 'added'; return n; });
    handleSaveField(record, fn, idx, sid, null, reconstructFullText(cs), `${fn}-${idx}`);
  }

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [title, ...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => searchTerm.trim() ? phraseMatch(t, searchTerm) : false;
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const v = getFieldValue(record, fn, idx); const vText = Array.isArray(v) ? v.join(' ') : v; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(vText, searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => { const title = `Biologic Therapy ${idx + 1}`; const allText = [title, formatDate(record.date), formatDate(record.startDate), record.medicationName, record.indication, record.dose, record.route, record.frequency, record.response, record.priorAuthorization, record.baselineAssessment, Array.isArray(record.monitoringLabs) ? record.monitoringLabs.join(' ') : '', record.sideEffects, record.infusionReactions, record.continuationPlan, record.provider, record.facility, record.notes, ...Object.values(FIELD_LABELS), ...Object.values(SECTION_TITLES)].filter(Boolean).join(' '); const match = phraseMatch(allText, searchTerm); if (match && phraseMatch(title, searchTerm)) record._showAllSections = true; return match; });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const dv = String(value || ''); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    // A single labeled value "X: y" → nested-subtitle = parsed label, row = value; reconstruct on save (lossless).
    const p = parseLabel(dv);
    // Numeric measurement (e.g. "90mg") → number stepper; the unit stays fixed. Labeled values are excluded.
    const nu = p.isLabeled ? null : splitNumberUnit(dv);
    const subtitle = p.isLabeled ? p.label : (hideLabel ? null : (FIELD_LABELS[fn] || fn));
    const rowText = p.isLabeled ? p.value : dv; const editSeed = nu ? nu.number : (p.isLabeled ? p.value : dv);
    const buildSave = (nv) => nu ? `${nu.prefix}${nv}${nu.sep}${nu.unit}` : (p.isLabeled ? `${p.label}: ${nv}` : nv);
    const copyText = p.isLabeled ? `${p.label}: ${p.value}` : `${FIELD_LABELS[fn] || fn}: ${dv}`;
    const useCard = !hideLabel || p.isLabeled;
    if (ie) return (<div className={useCard ? 'rec-mini-card' : undefined}>{subtitle && <div className="nested-subtitle">{highlightText(subtitle)}</div>}<div className="edit-field-container">{nu ? (<div className="num-unit-edit">{nu.prefix && <span className="nu-affix">{nu.prefix}</span>}<input type="number" className="edit-number" step={nu.step} value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !(editValue === '' || isNaN(parseFloat(editValue)))) handleSaveField(record, fn, idx, sid, null, buildSave(editValue)); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} />{nu.unit && <span className="nu-affix">{nu.unit}</span>}</div>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid, null, buildSave(editValue)); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => { if (nu && (editValue === '' || isNaN(parseFloat(editValue)))) return; handleSaveField(record, fn, idx, sid, null, buildSave(editValue)); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={useCard ? 'rec-mini-card' : undefined}>{subtitle && <div className="nested-subtitle">{highlightText(subtitle)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(editSeed); }}><div className="row-content"><span className="content-value">{highlightText(rowText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(copyText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderDateField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`; const dv = formatDate(value);
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><input type="date" className="edit-date" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { try { el.showPicker(); } catch {} } }} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { if (!editValue || isNaN(new Date(editValue).getTime())) return; handleSaveField(record, fn, idx, sid, null, editValue + 'T00:00:00.000Z'); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(value)); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(`${FIELD_LABELS[fn] || fn}: ${dv}`, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  // ARRAY field (monitoringLabs) — one nested-subtitle label, each item its own editable row.
  const renderArrayField = (record, fn, idx, sid) => {
    const value = getFieldValue(record, fn, idx); const arr = Array.isArray(value) ? value : [];
    const items = arr.map((it, oi) => ({ text: String(it == null ? '' : it), _origIdx: oi })).filter(it => it.text.trim().length > 0);
    if (items.length === 0) return null;
    const label = FIELD_LABELS[fn] || fn; const ed = editedFields[`${fn}-${idx}`];
    const vis = items.filter(item => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(label)) return true; return phraseMatch(item.text, searchTerm); });
    if (vis.length === 0) return null;
    const saveItem = (itemIdx, newText) => { const cur = Array.isArray(getFieldValue(record, fn, idx)) ? [...getFieldValue(record, fn, idx)] : []; cur[itemIdx] = newText.trim(); const filtered = cur.filter(x => String(x).trim().length > 0); handleSaveField(record, fn, idx, sid, null, filtered, `${fn}-${idx}`); };
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label)}</div>{vis.map(({ text, _origIdx: ii }) => {
      const iKey = `${fn}-${idx}-a${ii}`; const ie = editingField === iKey; const cid = `row-${fn}-${idx}-${ii}`;
      if (ie) return (<div key={ii} className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveItem(ii, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveItem(ii, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>);
      return (<div key={ii} className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(iKey); setEditValue(text); }}><div className="row-content"><span className="content-value">{highlightText(text)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>);
    })}{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderSentenceEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const ss = splitBySentence(String(value)); if (ss.length <= 1) return renderEditableField(record, fn, idx, sid, hideLabel);
    const label = FIELD_LABELS[fn] || fn;
    const vis = ss.map((s, oi) => ({ text: s, _origIdx: oi })).filter(item => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(label)) return true; return phraseMatch(item.text, searchTerm); });
    if (vis.length === 0) return null;
    return (<>{vis.map(({ text, _origIdx: sIdx }, vi) => { const sk = `${fn}-${idx}-s${sIdx}`; const ie = editingField === sk; const es = editedSentences[sk]; const scid = `row-${fn}-${idx}-s${sIdx}`; const p = parseLabel(text); const showLabel = vi === 0 && !hideLabel;
      if (ie) return (<div key={sIdx} className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={sIdx} className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(label)}</div>}{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(text.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(p.isLabeled ? p.value : text)}</span>{!es && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === scid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, scid); }}>{copiedId === scid ? 'Copied' : 'Copy'}</button></div>{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
    })}</>);
  };

  // Type-dispatched field renderer.
  const renderField = (record, fn, idx, sid, hideLabel) => {
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid, hideLabel);
    if (ARRAY_FIELDS.includes(fn)) return renderArrayField(record, fn, idx, sid);
    if (SENTENCE_FIELDS.includes(fn)) return renderSentenceEditableField(record, fn, idx, sid, hideLabel);
    return renderEditableField(record, fn, idx, sid, hideLabel);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  // Copy a field reflecting the JSX nested-subtitle: a labeled sentence "X: y" → nested (label line + indented
  // value), plain multi-sentence → numbered, plain single value → "Label: value".
  const formatFieldForCopy = (label, value) => {
    const sv = String(value); const ss = splitBySentence(sv);
    if (ss.length > 1) {
      if (ss.some(s => parseLabel(s).isLabeled)) { let t = `${label}:\n`; ss.forEach(s => { const p = parseLabel(s); t += p.isLabeled ? `  ${p.label}:\n    ${p.value}\n` : `  ${s}\n`; }); return t; }
      let t = `${label}:\n`; ss.forEach((s, i) => { t += `  ${i + 1}. ${s}\n`; }); return t;
    }
    const p = parseLabel(sv);
    if (p.isLabeled) return `${label}:\n  ${p.label}:\n    ${p.value}\n`;
    return `${label}:\n  ${sv}\n`;
  };
  const formatArrayForCopy = (label, arr) => { const items = (Array.isArray(arr) ? arr : []).filter(x => String(x).trim()); if (items.length === 0) return ''; let t = `${label}:\n`; items.forEach((it, i) => { t += `  ${i + 1}. ${it}\n`; }); return t; };
  // Simple (non-narrative) fields are NEVER sentence-split (a provider like "Dr. A. Lee, MD" must stay one line).
  const formatSimpleForCopy = (label, value) => { const p = parseLabel(String(value)); if (p.isLabeled) return `${label}:\n  ${p.label}:\n    ${p.value}\n`; return `${label}:\n  ${String(value)}\n`; };
  const appendFieldCopy = (text, pr, f) => {
    const l = FIELD_LABELS[f] || f;
    if (ARRAY_FIELDS.includes(f)) return text + formatArrayForCopy(l, pr[f]);
    if (DATE_FIELDS.includes(f)) { const dv = formatDate(pr[f]); return dv ? text + `${l}:\n  ${dv}\n` : text; }
    const v = pr[f];
    if (v === null || v === undefined || String(v).trim() === '') return text;
    return text + (SENTENCE_FIELDS.includes(f) ? formatFieldForCopy(l, v) : formatSimpleForCopy(l, v));
  };
  const copySectionText = (record, idx, sid) => { const pr = pdfData[idx] || record; const fs = SECTION_FIELDS[sid] || []; let text = `${SECTION_TITLES[sid] || sid}\n`; fs.forEach(f => { text = appendFieldCopy(text, pr, f); }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); };
  const copyAllContent = () => { let text = '=== BIOLOGIC THERAPY ===\n\n'; pdfData.forEach((r, idx) => { if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n'; text += `Biologic Therapy ${idx + 1}\n`; if (r.date) text += `Date: ${formatDate(r.date)}\n`; text += '\n'; Object.entries(SECTION_FIELDS).forEach(([, fs]) => { fs.forEach(f => { text = appendFieldCopy(text, r, f); }); }); }); copyToClipboard(text.trim(), 'copy-all'); };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  // A section is rendered iff at least one of its fields has a value; the single-field narrative sections
  // hide the duplicate field label (section title == field label).
  const renderConfiguredSection = (record, idx, sid) => {
    const fs = SECTION_FIELDS[sid] || []; const title = SECTION_TITLES[sid] || sid;
    const hasData = fs.some(f => { const v = getFieldValue(record, f, idx); return Array.isArray(v) ? v.filter(x => String(x).trim()).length > 0 : (v !== null && v !== undefined && String(v).trim() !== ''); });
    if (!hasData) return null;
    const contentParts = fs.map(f => { const v = getFieldValue(record, f, idx); return DATE_FIELDS.includes(f) ? formatDate(record[f]) : (Array.isArray(v) ? v.join(' ') : v); }).filter(Boolean);
    if (!shouldShowSection(record, title, contentParts, fs)) return null;
    const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
    const hideLabel = fs.length === 1 && (FIELD_LABELS[fs[0]] || fs[0]) === title;
    const children = fs.map(f => (sa || fieldMatches(record, f, idx)) ? <React.Fragment key={f}>{renderField(record, f, idx, sid, hideLabel)}</React.Fragment> : null).filter(Boolean);
    if (children.length === 0) return null;
    return renderSection(record, idx, sid, title, <>{children}</>);
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="biologic-therapy-document"><header className="document-header"><h1 className="document-title">Biologic Therapy</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="biologic-therapy-document">
      <header className="document-header">
        <h1 className="document-title">Biologic Therapy</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BiologicTherapyDocumentPDFTemplate document={pdfData} />} fileName="Biologic_Therapy.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Biologic Therapy ${idx + 1}`)}</h3></div>
            </div>
            {Object.keys(SECTION_FIELDS).map(sid => <React.Fragment key={sid}>{renderConfiguredSection(record, idx, sid)}</React.Fragment>)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BiologicTherapyDocument;
