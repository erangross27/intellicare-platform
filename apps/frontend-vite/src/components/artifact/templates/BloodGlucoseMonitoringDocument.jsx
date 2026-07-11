/**
 * BloodGlucoseMonitoringDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BloodGlucoseMonitoringDocumentPDFTemplate from '../pdf-templates/BloodGlucoseMonitoringDocumentPDFTemplate';
import './BloodGlucoseMonitoringDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'blood_glucose_monitoringPendingEdits';
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
  providerInfo: ['provider', 'facility', 'reviewPeriod'],
  monitoring: ['monitoringMethod', 'deviceType', 'frequency'],
  metrics: ['averageGlucose', 'timeInRange', 'timeAboveRange', 'timeBelowRange', 'glucoseVariability'],
  patterns: ['patterns'],
  clinical: ['hypoglycemicEvents', 'adherence'],
  adjustments: ['adjustments'],
  notes: ['notes'],
};
const FIELD_LABELS = { provider: 'Provider', facility: 'Facility', reviewPeriod: 'Review Period', monitoringMethod: 'Monitoring Method', deviceType: 'Device Type', frequency: 'Frequency', averageGlucose: 'Average Glucose', timeInRange: 'Time In Range', timeAboveRange: 'Time Above Range', timeBelowRange: 'Time Below Range', glucoseVariability: 'Glucose Variability', hypoglycemicEvents: 'Hypoglycemic Events', adherence: 'Adherence', adjustments: 'Adjustments', notes: 'Notes' };
const ARRAY_FIELDS = ['patterns'];

/* Numeric fields edited with a <input type="number"> stepper (instead of a textarea).
   Values are stored as strings — "174 mg/dL", "58%", "35.6% CV", "95% sensor wear time".
   splitNumberUnit edits ONLY the number, keeps the prefix operator + unit as fixed affixes,
   and reassembles on save so the stored string format is preserved byte-for-byte (Copy / PDF /
   backend untouched). Returns null for non-numeric text ("Continuous"), ranges
   ("2-3 episodes ..."), or any value whose unit contains a digit ("36% (>180), 8% (>250)") →
   those keep the normal textarea. */
const NUMBER_FIELDS = ['averageGlucose', 'timeInRange', 'timeAboveRange', 'timeBelowRange', 'glucoseVariability', 'adherence', 'frequency', 'hypoglycemicEvents'];
const splitNumberUnit = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([<>≤≥=~]*)\s*(-?\d+(?:\.\d+)?)(\s*)(\S.*)?$/);
  if (!m) return null;
  const unit = (m[4] || '').trim();
  if (/^[-–—]\s*\d/.test(unit)) return null;   // range ("2-3 episodes ...") → keep textarea
  if (/\d/.test(unit)) return null;            // unit has a digit ("% (>180), 8% (>250)") → keep textarea
  const decimals = (m[2].split('.')[1] || '').length;
  return { prefix: m[1] || '', number: m[2], sep: m[3] || '', unit, step: decimals > 0 ? Math.pow(10, -decimals) : 1 };
};

const BloodGlucoseMonitoringDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});
  const [approving, setApproving] = useState(false);

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.blood_glucose_monitoring) return Array.isArray(r.blood_glucose_monitoring) ? r.blood_glucose_monitoring : [r.blood_glucose_monitoring]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.blood_glucose_monitoring) return Array.isArray(dd.blood_glucose_monitoring) ? dd.blood_glucose_monitoring : [dd.blood_glucose_monitoring]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  // Store fieldPart = "field" (plain) or "field.arrayIndex" (array element) → mapped to this file's
  // editKey convention: `${fn}-${idx}` (plain) or `${fn}-${idx}-${ai}` (array).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArrayPart = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArrayPart
          ? `${fieldPart.slice(0, dotIdx)}-${idx}-${fieldPart.slice(dotIdx + 1)}`
          : `${fieldPart}-${idx}`;
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
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BloodGlucoseMonitoring] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button returns to yellow Pending Approve
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BloodGlucoseMonitoring] Cannot save — no record ID'); return; }
    const value = editValue;
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record/section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    setApproving(true);
    try {
      const sf = SECTION_FIELDS[sid] || [];
      // Pending edit keys for this record belonging to this section's fields.
      // Plain field key: `${fn}-${idx}`. Array element key: `${fn}-${idx}-${ai}`.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sf.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const ek of toCommit) {
        // Determine field + optional arrayIndex by reversing the editKey format for this field set.
        const matchField = sf.find(f => ek === `${f}-${idx}` || ek.startsWith(`${f}-${idx}-`));
        const payload = { field: matchField, value: localEdits[ek] };
        const arrSuffix = ek.slice(`${matchField}-${idx}`.length); // '' or '-<ai>'
        if (arrSuffix.startsWith('-') && /^\d+$/.test(arrSuffix.slice(1))) payload.arrayIndex = parseInt(arrSuffix.slice(1), 10);
        await sc.put(`/api/edit/blood_glucose_monitoring/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/blood_glucose_monitoring/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(ek => {
          const matchField = sf.find(f => ek === `${f}-${idx}` || ek.startsWith(`${f}-${idx}-`));
          const arrSuffix = ek.slice(`${matchField}-${idx}`.length);
          const fieldPart = (arrSuffix.startsWith('-') && /^\d+$/.test(arrSuffix.slice(1))) ? `${matchField}.${arrSuffix.slice(1)}` : matchField;
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BloodGlucoseMonitoring] Approve failed:', err); }
    finally { setApproving(false); }
  }, [localEdits, pendingEdits]);

  const handleSaveFieldWithValue = useCallback((record, fn, idx, sid, valueOverride, editTrackingKey) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BloodGlucoseMonitoring] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: valueOverride }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [editTrackingKey || ek]: 'edited' }));
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = valueOverride;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const splitBySentence = (text) => { if (!text) return []; return text.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const val = String(getFieldValue(record, fieldName, idx) || '');
    if (!val.trim()) return null;
    if (!shouldShowSection(record, title, [val], [fieldName])) return null;
    const sentences = splitBySentence(val);
    if (sentences.length <= 1) return renderSection(record, idx, sid, title, renderEditableField(record, fieldName, idx, sid, true));
    const stm = sectionTitleMatches(title);
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
      {sentences.map((sentence, si) => { if (!sa && !phraseMatch(sentence, searchTerm)) return null; const partKey = `${fieldName}-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `${sid}-${idx}-${si}`; const displayText = sentence.replace(/\.$/, ''); if (isEditing) return (<div key={si} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { const parts = splitBySentence(val); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const parts = splitBySentence(val); parts[si] = editValue.trim(); const newFull = parts.filter(p => p.trim().length > 0).map(p => p.replace(/\.$/, '')).join('. ') + '.'; handleSaveFieldWithValue(record, fieldName, idx, sid, newFull, partKey); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>); return (<React.Fragment key={si}><div className="rec-mini-card"><div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(displayText); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(displayText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div></React.Fragment>); }).filter(Boolean)}
    </div></div>);
  };

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Blood Glucose Monitoring ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), record.monitoringMethod, record.deviceType, record.frequency, record.averageGlucose, record.timeInRange, record.timeAboveRange, record.timeBelowRange, record.glucoseVariability, ...(Array.isArray(record.patterns) ? record.patterns : []), record.hypoglycemicEvents, record.adherence, record.adjustments, record.notes, record.provider, record.facility, record.reviewPeriod, ...Object.values(FIELD_LABELS), 'Provider Information', 'Monitoring Details', 'Glucose Metrics', 'Glucose Patterns', 'Clinical Events', 'Adjustments', 'Notes'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }} disabled={approving}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && value !== false && !localEdits[`${fn}-${idx}`]) return null;
    const dv = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '');
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    // Numeric fields → edit the number with a <input type="number"> stepper (keep prefix/unit fixed);
    // non-numeric values (ranges, compound multi-number, free text) fall back to the textarea.
    const nu = NUMBER_FIELDS.includes(fn) ? splitNumberUnit(dv) : null;
    const saveNumber = () => { const t = editValue.trim(); if (t === '' || isNaN(parseFloat(t))) return; handleSaveFieldWithValue(record, fn, idx, sid, `${nu.prefix}${t}${nu.sep}${nu.unit}`); };
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">{nu ? (<div className="num-unit-edit">{nu.prefix && <span className="nu-affix">{nu.prefix}</span>}<input type="number" className="edit-number" step={nu.step} value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNumber(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} />{nu.unit && <span className="nu-affix">{nu.unit}</span>}</div>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'notes' || fn === 'adjustments' ? 4 : 1} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => nu ? saveNumber() : handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(nu ? nu.number : dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<div key={ai} className="rec-mini-card"><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div key={ai} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; /* pending drafts stay OUT of the PDF until approved */ const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    if (sid === 'providerInfo') { if (pr.provider) text += `Provider: ${pr.provider}\n`; if (pr.facility) text += `Facility: ${pr.facility}\n`; if (pr.reviewPeriod) text += `Review Period: ${pr.reviewPeriod}\n`; }
    else if (sid === 'monitoring') { if (pr.monitoringMethod) text += `Monitoring Method: ${pr.monitoringMethod}\n`; if (pr.deviceType) text += `Device Type: ${pr.deviceType}\n`; if (pr.frequency) text += `Frequency: ${pr.frequency}\n`; }
    else if (sid === 'metrics') { if (pr.averageGlucose) text += `Average Glucose: ${pr.averageGlucose}\n`; if (pr.timeInRange) text += `Time In Range: ${pr.timeInRange}\n`; if (pr.timeAboveRange) text += `Time Above Range: ${pr.timeAboveRange}\n`; if (pr.timeBelowRange) text += `Time Below Range: ${pr.timeBelowRange}\n`; if (pr.glucoseVariability) text += `Glucose Variability: ${pr.glucoseVariability}\n`; }
    else if (sid === 'patterns') { const items = getEffectiveArray(pr, 'patterns', idx); items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'clinical') { if (pr.hypoglycemicEvents) text += `Hypoglycemic Events: ${pr.hypoglycemicEvents}\n`; if (pr.adherence) text += `Adherence: ${pr.adherence}\n`; }
    else if (sid === 'adjustments') { if (pr.adjustments) { splitBySentence(pr.adjustments).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    else if (sid === 'notes') { if (pr.notes) { splitBySentence(pr.notes).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); } }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BLOOD GLUCOSE MONITORING ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Blood Glucose Monitoring ${idx + 1}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      if (r.provider || r.facility || r.reviewPeriod) { text += '\nPROVIDER INFORMATION\n'; if (r.provider) text += `Provider: ${r.provider}\n`; if (r.facility) text += `Facility: ${r.facility}\n`; if (r.reviewPeriod) text += `Review Period: ${r.reviewPeriod}\n`; }
      if (r.monitoringMethod || r.deviceType || r.frequency) { text += '\nMONITORING DETAILS\n'; if (r.monitoringMethod) text += `Monitoring Method: ${r.monitoringMethod}\n`; if (r.deviceType) text += `Device Type: ${r.deviceType}\n`; if (r.frequency) text += `Frequency: ${r.frequency}\n`; }
      if (r.averageGlucose || r.timeInRange || r.timeAboveRange || r.timeBelowRange || r.glucoseVariability) { text += '\nGLUCOSE METRICS\n'; if (r.averageGlucose) text += `Average Glucose: ${r.averageGlucose}\n`; if (r.timeInRange) text += `Time In Range: ${r.timeInRange}\n`; if (r.timeAboveRange) text += `Time Above Range: ${r.timeAboveRange}\n`; if (r.timeBelowRange) text += `Time Below Range: ${r.timeBelowRange}\n`; if (r.glucoseVariability) text += `Glucose Variability: ${r.glucoseVariability}\n`; }
      const pt = getEffectiveArray(r, 'patterns', idx); if (pt.length > 0) { text += '\nGLUCOSE PATTERNS\n'; pt.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      if (r.hypoglycemicEvents || r.adherence) { text += '\nCLINICAL EVENTS\n'; if (r.hypoglycemicEvents) text += `Hypoglycemic Events: ${r.hypoglycemicEvents}\n`; if (r.adherence) text += `Adherence: ${r.adherence}\n`; }
      if (r.adjustments) { text += '\nADJUSTMENTS\n'; splitBySentence(r.adjustments).forEach((s, i) => { text += `${i + 1}. ${s.replace(/\.$/, '')}\n`; }); }
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

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="blood-glucose-monitoring-document"><header className="document-header"><h1 className="document-title">Blood Glucose Monitoring</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="blood-glucose-monitoring-document">
      <header className="document-header">
        <h1 className="document-title">Blood Glucose Monitoring</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BloodGlucoseMonitoringDocumentPDFTemplate document={pdfData} />} fileName="Blood_Glucose_Monitoring.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Blood Glucose Monitoring ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'providerInfo', 'Provider Information', ['provider', 'facility', 'reviewPeriod'])}
            {renderMultiFieldSection(record, idx, 'monitoring', 'Monitoring Details', ['monitoringMethod', 'deviceType', 'frequency'])}
            {renderMultiFieldSection(record, idx, 'metrics', 'Glucose Metrics', ['averageGlucose', 'timeInRange', 'timeAboveRange', 'timeBelowRange', 'glucoseVariability'])}

            {/* Glucose Patterns (array) */}
            {record.patterns?.length > 0 && shouldShowSection(record, 'Glucose Patterns', record.patterns, ['patterns']) && renderSection(record, idx, 'patterns', 'Glucose Patterns', (() => { const stm = sectionTitleMatches('Glucose Patterns'); const sa = !searchTerm.trim() || record._showAllSections || stm; return record.patterns.map((item, ai) => { const val = localEdits[`patterns-${idx}-${ai}`] !== undefined ? localEdits[`patterns-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'patterns', idx, 'patterns', item, ai); }).filter(Boolean); })())}

            {renderMultiFieldSection(record, idx, 'clinical', 'Clinical Events', ['hypoglycemicEvents', 'adherence'])}

            {/* Adjustments */}
            {renderSentenceSplitSection(record, idx, 'adjustments', 'Adjustments', 'adjustments')}

            {/* Notes */}
            {renderSentenceSplitSection(record, idx, 'notes', 'Notes', 'notes')}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BloodGlucoseMonitoringDocument;
