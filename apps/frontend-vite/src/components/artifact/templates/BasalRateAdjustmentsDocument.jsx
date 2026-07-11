/**
 * BasalRateAdjustmentsDocument.jsx
 * Inline editing with per-section approve, per-row copy,
 * PDFDownloadLink + pdfData memo, secureApiClient for all API calls.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BasalRateAdjustmentsPDFTemplate from '../pdf-templates/BasalRateAdjustmentsPDFTemplate';
import './BasalRateAdjustmentsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } } */
const DRAFT_KEY = 'basal_rate_adjustmentsPendingEdits';
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
  pumpInfo: ['insulinPumpModel', 'totalDailyBasal', 'effectiveDate'],
  adjustment: ['timeBlock', 'oldRate', 'newRate', 'reasonForChange', 'glucosePattern'],
  followUp: ['followUpPlan'],
  notes: ['notes'],
};
const FIELD_LABELS = { provider: 'Provider', facility: 'Facility', insulinPumpModel: 'Insulin Pump Model', totalDailyBasal: 'Total Daily Basal', effectiveDate: 'Effective Date', timeBlock: 'Time Block', oldRate: 'Old Rate', newRate: 'New Rate', reasonForChange: 'Reason for Change', glucosePattern: 'Glucose Pattern', followUpPlan: 'Follow-Up Plan', notes: 'Notes' };
const DATE_FIELDS = ['effectiveDate'];
const toInputDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toISOString().split('T')[0]; } catch { return ''; } };
// A single sentence "Label: value" → {isLabeled,label,value}. ':\s+' (space after colon) avoids matching
// "t:slim"/times/ratios; the {1,80} cap stops a long sentence with a deep colon from false-matching.
const parseLabel = (s) => { if (!s || typeof s !== 'string') return { isLabeled: false, label: '', value: s || '' }; const m = s.match(/^([^:]{1,80}):\s+(\S.*)$/s); if (m) return { isLabeled: true, label: m[1].trim(), value: m[2].trim() }; return { isLabeled: false, label: '', value: s }; };
// "1.10 units/hour" → edit ONLY the number with a stepper, keep the unit fixed; reassemble on save (lossless).
// Returns null for prose, and for any value whose unit holds a digit (time range "3 AM - 6 AM", "140-180 mg/dL")
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

const BasalRateAdjustmentsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.basal_rate_adjustments) return Array.isArray(r.basal_rate_adjustments) ? r.basal_rate_adjustments : [r.basal_rate_adjustments]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.basal_rate_adjustments) return Array.isArray(dd.basal_rate_adjustments) ? dd.basal_rate_adjustments : [dd.basal_rate_adjustments]; return [dd]; } return r; });
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
  // Abbreviation-safe: do NOT split after Dr./Mr./St./etc. (so "Dr. David Chen, MD, PhD" stays one unit in Copy).
  const splitBySentence = (text) => { if (!text || typeof text !== 'string') return []; return text.split(/(?<!\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)\.)(?<=[.!?])\s+/).filter(s => { const t = s.trim(); return t.length > 0 && t.replace(/[.!?;,]+/g, '').trim().length > 0; }); };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BasalRateAdjustments] Cannot save — no record ID'); return; }
    const nv = valueOverride !== undefined ? valueOverride : editValue;
    const ek = editTrackingKey || `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: nv }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    if (sentenceIdx !== undefined && sentenceIdx !== null) setEditedSentences(prev => ({ ...prev, [editTrackingKey || `${fn}-${idx}-s${sentenceIdx}`]: 'edited' }));
    else setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section's 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    // fieldPart is the field name only (this template has no array/dotted-index edits)
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
      // Collect this record's pending edits belonging to this section's fields
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && sf.includes(k.slice(0, -suffix.length)));
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" (no array/dotted index in this template)
        const lastDot = fieldPart.lastIndexOf('.');
        const payload = (lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1)))
          ? { field: fieldPart.slice(0, lastDot), value: localEdits[editKey], arrayIndex: parseInt(fieldPart.slice(lastDot + 1), 10) }
          : { field: fieldPart, value: localEdits[editKey] };
        await sc.put(`/api/edit/basal_rate_adjustments/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/basal_rate_adjustments/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const next = { ...prev }; toCommit.forEach(k => delete next[k]); return next; });
      // Drop this record's drafts for the committed fields from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { delete store[rid][k.slice(0, -suffix.length)]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
      setEditedSentences(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BasalRateAdjustments] Approve failed:', err); } finally { setSaving(false); }
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
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    return records.filter((record, idx) => { const title = `Basal Rate Adjustment ${idx + 1}`; const allText = [title, formatDate(record.date), formatDate(record.effectiveDate), record.insulinPumpModel, record.timeBlock, record.oldRate, record.newRate, record.reasonForChange, record.glucosePattern, record.totalDailyBasal, record.followUpPlan, record.provider, record.facility, record.notes, ...Object.values(FIELD_LABELS), 'Record Information', 'Pump Information', 'Rate Adjustment', 'Follow-Up', 'Notes'].filter(Boolean).join(' '); const match = phraseMatch(allText, searchTerm); if (match && phraseMatch(title, searchTerm)) record._showAllSections = true; return match; });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`)) || Object.keys(editedSentences).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && !localEdits[`${fn}-${idx}`]) return null;
    const dv = String(value || ''); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    // A single labeled value (e.g. notes "Also decreasing ...: 0.90 → 0.75 ...") → nested-subtitle = parsed
    // label, row = value; edit the value and reconstruct "label: value" on save (lossless round-trip).
    const p = parseLabel(dv);
    // Numeric measurement (e.g. "1.10 units/hour") → number stepper; the unit stays fixed. Labeled values are excluded.
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

  const renderSentenceEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value) return null;
    const ss = splitBySentence(String(value)); if (ss.length <= 1) return renderEditableField(record, fn, idx, sid, hideLabel);
    const vis = ss.map((s, oi) => ({ text: s, _origIdx: oi })).filter(item => { if (!searchTerm.trim() || record._showAllSections) return true; if (sectionTitleMatches(FIELD_LABELS[fn] || fn)) return true; return phraseMatch(item.text, searchTerm); });
    if (vis.length === 0) return null;
    return (<>{vis.map(({ text, _origIdx: sIdx }) => { const sk = `${fn}-${idx}-s${sIdx}`; const ie = editingField === sk; const es = editedSentences[sk]; const scid = `row-${fn}-${idx}-s${sIdx}`; const p = parseLabel(text);
      if (ie) return (<div key={sIdx} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(record, fn, idx, sid, sIdx, editValue); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveSentence(record, fn, idx, sid, sIdx, editValue)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div key={sIdx} className="rec-mini-card">{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className={`numbered-row editable-row${es ? ' modified' : ''}`} onClick={() => { setEditingField(sk); setEditValue(text.replace(/[.!?;]+$/, '')); }}><div className="row-content"><span className="content-value">{highlightText(p.isLabeled ? p.value : text)}</span>{!es && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === scid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(text, scid); }}>{copiedId === scid ? 'Copied' : 'Copy'}</button></div>{es && <div className={`modified-badge${es === 'added' ? ' added' : ''}`}>{es === 'added' ? 'added - click Pending Approve to save' : 'edited - click Pending Approve to save'}</div>}</div>);
    })}</>);
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
  const copySectionText = (record, idx, sid) => { const pr = pdfData[idx] || record; const fs = SECTION_FIELDS[sid] || []; let text = ''; fs.forEach(f => { const l = FIELD_LABELS[f] || f; const v = DATE_FIELDS.includes(f) ? formatDate(pr[f]) : pr[f]; if (!v) return; text += formatFieldForCopy(l, v); }); copyToClipboard(text.trim(), `section-${sid}-${idx}`); };
  const copyAllContent = () => { let text = '=== BASAL RATE ADJUSTMENTS ===\n\n'; pdfData.forEach((r, idx) => { if (idx > 0) text += '\n' + '='.repeat(60) + '\n\n'; text += `Basal Rate Adjustment ${idx + 1}\n`; if (r.date) text += `Date: ${formatDate(r.date)}\n\n`; Object.entries(SECTION_FIELDS).forEach(([, fs]) => { fs.forEach(f => { const v = DATE_FIELDS.includes(f) ? formatDate(r[f]) : r[f]; if (v) text += formatFieldForCopy(FIELD_LABELS[f] || f, v); }); }); }); copyToClipboard(text.trim(), 'copy-all'); };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="basal-rate-adjustments-document"><header className="document-header"><h1 className="document-title">Basal Rate Adjustments</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="basal-rate-adjustments-document">
      <header className="document-header">
        <h1 className="document-title">Basal Rate Adjustments</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BasalRateAdjustmentsPDFTemplate document={pdfData} />} fileName="Basal_Rate_Adjustments.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Basal Rate Adjustment ${idx + 1}`)}</h3></div>
            </div>

            {(() => { const hd = [record.provider, record.facility].some(v => v && String(v).trim()); if (!hd) return null; if (!shouldShowSection(record, 'Record Information', [record.provider, record.facility].filter(Boolean), ['provider', 'facility'])) return null; const stm = sectionTitleMatches('Record Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'recordInfo', 'Record Information', <>{(sa || fieldMatches(record, 'provider', idx)) && renderEditableField(record, 'provider', idx, 'recordInfo')}{(sa || fieldMatches(record, 'facility', idx)) && renderEditableField(record, 'facility', idx, 'recordInfo')}</>); })()}

            {(() => { if (!shouldShowSection(record, 'Pump Information', [record.insulinPumpModel, record.totalDailyBasal, formatDate(record.effectiveDate)].filter(Boolean), ['insulinPumpModel', 'totalDailyBasal', 'effectiveDate'])) return null; const stm = sectionTitleMatches('Pump Information'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'pumpInfo', 'Pump Information', <>{(sa || fieldMatches(record, 'insulinPumpModel', idx)) && renderEditableField(record, 'insulinPumpModel', idx, 'pumpInfo')}{(sa || fieldMatches(record, 'totalDailyBasal', idx)) && renderEditableField(record, 'totalDailyBasal', idx, 'pumpInfo')}{(sa || fieldMatches(record, 'effectiveDate', idx)) && renderDateField(record, 'effectiveDate', idx, 'pumpInfo')}</>); })()}

            {(() => { const fields = ['timeBlock', 'oldRate', 'newRate', 'reasonForChange', 'glucosePattern']; if (!shouldShowSection(record, 'Rate Adjustment', fields.map(f => record[f]).filter(Boolean), fields)) return null; const stm = sectionTitleMatches('Rate Adjustment'); const sa = !searchTerm.trim() || record._showAllSections || stm; return renderSection(record, idx, 'adjustment', 'Rate Adjustment', <>{fields.map(f => (sa || fieldMatches(record, f, idx)) ? renderEditableField(record, f, idx, 'adjustment') : null)}</>); })()}

            {getFieldValue(record, 'followUpPlan', idx) && shouldShowSection(record, 'Follow-Up', [getFieldValue(record, 'followUpPlan', idx)], ['followUpPlan']) && renderSection(record, idx, 'followUp', 'Follow-Up', renderSentenceEditableField(record, 'followUpPlan', idx, 'followUp', true))}

            {getFieldValue(record, 'notes', idx) && shouldShowSection(record, 'Notes', [getFieldValue(record, 'notes', idx)], ['notes']) && renderSection(record, idx, 'notes', 'Notes', renderSentenceEditableField(record, 'notes', idx, 'notes', true))}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BasalRateAdjustmentsDocument;
