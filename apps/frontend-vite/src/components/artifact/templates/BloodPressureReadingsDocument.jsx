/**
 * BloodPressureReadingsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BloodPressureReadingsDocumentPDFTemplate from '../pdf-templates/BloodPressureReadingsDocumentPDFTemplate';
import './BloodPressureReadingsDocument.css';

const SECTION_FIELDS = {
  bpReading: ['systolicPressure', 'diastolicPressure', 'heartRate', 'meanArterialPressure', 'pulseWidth'],
  measurement: ['measurementPosition', 'cuffSize', 'measurementArm'],
  classification: ['ahaStageClassification', 'hypertensiveCrisis'],
  orthostatic: ['orthostaticMeasurement', 'orthostaticSystolic', 'orthostaticDiastolic'],
  vascular: ['ankleBrachialIndex', 'toeBrachialIndex', 'centralAorticPressure', 'augmentationIndex', 'pulseWaveVelocity'],
  monitoring: ['ambulatoryMonitoring', 'homeMonitoring', 'whiteCoatEffect', 'maskedHypertension'],
  medications: ['antihypertensiveMedications'],
  risk: ['cardiovascularRiskScore'],
};
const FIELD_LABELS = { systolicPressure: 'Systolic Pressure', diastolicPressure: 'Diastolic Pressure', heartRate: 'Heart Rate', meanArterialPressure: 'Mean Arterial Pressure', pulseWidth: 'Pulse Width', measurementPosition: 'Measurement Position', cuffSize: 'Cuff Size', measurementArm: 'Measurement Arm', ahaStageClassification: 'AHA Stage Classification', hypertensiveCrisis: 'Hypertensive Crisis', orthostaticMeasurement: 'Orthostatic Measurement', orthostaticSystolic: 'Orthostatic Systolic', orthostaticDiastolic: 'Orthostatic Diastolic', ankleBrachialIndex: 'Ankle Brachial Index', toeBrachialIndex: 'Toe Brachial Index', centralAorticPressure: 'Central Aortic Pressure', augmentationIndex: 'Augmentation Index', pulseWaveVelocity: 'Pulse Wave Velocity', ambulatoryMonitoring: 'Ambulatory Monitoring', homeMonitoring: 'Home Monitoring', whiteCoatEffect: 'White Coat Effect', maskedHypertension: 'Masked Hypertension', cardiovascularRiskScore: 'Cardiovascular Risk Score' };
const ARRAY_FIELDS = ['antihypertensiveMedications'];
const NUMBER_FIELDS = ['systolicPressure', 'diastolicPressure', 'heartRate', 'meanArterialPressure', 'pulseWidth', 'orthostaticSystolic', 'orthostaticDiastolic', 'ankleBrachialIndex', 'toeBrachialIndex', 'centralAorticPressure', 'augmentationIndex', 'pulseWaveVelocity', 'cardiovascularRiskScore'];
const BOOLEAN_FIELDS = ['hypertensiveCrisis', 'orthostaticMeasurement', 'ambulatoryMonitoring', 'homeMonitoring', 'whiteCoatEffect', 'maskedHypertension'];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'blood_pressure_readingsPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const BloodPressureReadingsDocument = ({ document: rawDoc }) => {
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

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => { if (r?.blood_pressure_readings) return Array.isArray(r.blood_pressure_readings) ? r.blood_pressure_readings : [r.blood_pressure_readings]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.blood_pressure_readings) return Array.isArray(dd.blood_pressure_readings) ? dd.blood_pressure_readings : [dd.blood_pressure_readings]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = (() => { const id = record && record._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); })();
      const recDrafts = rid ? store[rid] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" (scalar) or "field.arrayIndex" (array element). Build the same editKey
        // the save handlers use: scalar `${fn}-${idx}`, array `${fn}-${idx}-${ai}`.
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArray = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArray
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

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  const getEffectiveArray = useCallback((record, fieldName, idx) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (pendingEdits[ek]) return; if (localEdits[ek] !== undefined) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BloodPressureReadings] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's approved flag so the button goes back to yellow
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Save (array element) = stage a DRAFT locally + localStorage. Committed only on Approve.
  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BloodPressureReadings] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    const fieldPart = `${fn}.${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fieldPart] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      // Collect this record's pending editKeys that belong to one of this section's fields.
      // Scalar key = `${fn}-${idx}`, array key = `${fn}-${idx}-${ai}`.
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        return sf.some(f => k === `${f}-${idx}` || k.startsWith(`${f}-${idx}-`));
      });
      for (const ek of toCommit) {
        // Identify which field this key belongs to + whether it's an array element.
        const f = sf.find(ff => ek === `${ff}-${idx}` || ek.startsWith(`${ff}-${idx}-`));
        if (!f) continue;
        const payload = { field: f, value: localEdits[ek] };
        const tail = ek.slice(`${f}-${idx}`.length); // '' for scalar, '-<ai>' for array element
        if (tail.startsWith('-') && /^\d+$/.test(tail.slice(1))) payload.arrayIndex = parseInt(tail.slice(1), 10);
        const resp = await sc.put(`/api/edit/blood_pressure_readings/${rid}/edit`, payload);
        if (resp && resp.success === false) throw new Error(resp.error || 'save failed');
      }
      await sc.put(`/api/edit/blood_pressure_readings/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed drafts from localStorage (only this section's fieldParts)
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(ek => {
          const f = sf.find(ff => ek === `${ff}-${idx}` || ek.startsWith(`${ff}-${idx}-`));
          if (!f) return;
          const tail = ek.slice(`${f}-${idx}`.length);
          const fieldPart = (tail.startsWith('-') && /^\d+$/.test(tail.slice(1))) ? `${f}.${tail.slice(1)}` : f;
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BloodPressureReadings] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Blood Pressure Reading ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), fmtVal(record.systolicPressure), fmtVal(record.diastolicPressure), fmtVal(record.heartRate), record.measurementPosition, record.ahaStageClassification, ...(Array.isArray(record.antihypertensiveMedications) ? record.antihypertensiveMedications : []), ...Object.values(FIELD_LABELS), 'Blood Pressure Reading', 'Measurement Details', 'Classification', 'Orthostatic Assessment', 'Vascular Assessment', 'Monitoring Status', 'Medications', 'Risk Assessment'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  // Save (typed boolean/number) = stage a DRAFT locally + localStorage. Committed only on Approve.
  const handleSaveTypedField = useCallback((record, fn, idx, sid, typedValue) => {
    const rid = getRecordId(record); if (!rid) { console.error('[BloodPressureReadings] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: typedValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = typedValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, []);

  const renderBooleanField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = raw ? 'Yes' : 'No';
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveTypedField(record, fn, idx, sid, editValue === 'Yes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNumberField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveTypedField(record, fn, idx, sid, n); };
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="number" step="any" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNum(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveNum} disabled={saving || isNaN(parseFloat(editValue))}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid) => {
    if (BOOLEAN_FIELDS.includes(fn)) return renderBooleanField(record, fn, idx, sid);
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid);
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
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
      Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; });
      ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx); });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    const addField = (fn) => { if (hasVal(pr[fn])) text += `${FIELD_LABELS[fn]}: ${fmtVal(pr[fn])}\n`; };
    if (sid === 'bpReading') { ['systolicPressure', 'diastolicPressure', 'heartRate', 'meanArterialPressure', 'pulseWidth'].forEach(addField); }
    else if (sid === 'measurement') { ['measurementPosition', 'cuffSize', 'measurementArm'].forEach(addField); }
    else if (sid === 'classification') { ['ahaStageClassification', 'hypertensiveCrisis'].forEach(addField); }
    else if (sid === 'orthostatic') { ['orthostaticMeasurement', 'orthostaticSystolic', 'orthostaticDiastolic'].forEach(addField); }
    else if (sid === 'vascular') { ['ankleBrachialIndex', 'toeBrachialIndex', 'centralAorticPressure', 'augmentationIndex', 'pulseWaveVelocity'].forEach(addField); }
    else if (sid === 'monitoring') { ['ambulatoryMonitoring', 'homeMonitoring', 'whiteCoatEffect', 'maskedHypertension'].forEach(addField); }
    else if (sid === 'medications') { const items = getEffectiveArray(pr, 'antihypertensiveMedications', idx); items.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
    else if (sid === 'risk') { ['cardiovascularRiskScore'].forEach(addField); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BLOOD PRESSURE READINGS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Blood Pressure Reading ${idx + 1}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      const addF = (fn) => { if (hasVal(r[fn])) text += `${FIELD_LABELS[fn]}: ${fmtVal(r[fn])}\n`; };
      const bpFs = ['systolicPressure', 'diastolicPressure', 'heartRate', 'meanArterialPressure', 'pulseWidth'].filter(f => hasVal(r[f])); if (bpFs.length) { text += '\nBLOOD PRESSURE READING\n'; bpFs.forEach(addF); }
      const msFs = ['measurementPosition', 'cuffSize', 'measurementArm'].filter(f => hasVal(r[f])); if (msFs.length) { text += '\nMEASUREMENT DETAILS\n'; msFs.forEach(addF); }
      const clFs = ['ahaStageClassification', 'hypertensiveCrisis'].filter(f => hasVal(r[f])); if (clFs.length) { text += '\nCLASSIFICATION\n'; clFs.forEach(addF); }
      const orFs = ['orthostaticMeasurement', 'orthostaticSystolic', 'orthostaticDiastolic'].filter(f => hasVal(r[f])); if (orFs.length) { text += '\nORTHOSTATIC ASSESSMENT\n'; orFs.forEach(addF); }
      const vaFs = ['ankleBrachialIndex', 'toeBrachialIndex', 'centralAorticPressure', 'augmentationIndex', 'pulseWaveVelocity'].filter(f => hasVal(r[f])); if (vaFs.length) { text += '\nVASCULAR ASSESSMENT\n'; vaFs.forEach(addF); }
      const moFs = ['ambulatoryMonitoring', 'homeMonitoring', 'whiteCoatEffect', 'maskedHypertension'].filter(f => hasVal(r[f])); if (moFs.length) { text += '\nMONITORING STATUS\n'; moFs.forEach(addF); }
      const meds = getEffectiveArray(r, 'antihypertensiveMedications', idx); if (meds.length) { text += '\nMEDICATIONS\n'; meds.forEach((item, i) => { text += `${i + 1}. ${item}\n`; }); }
      if (hasVal(r.cardiovascularRiskScore)) { text += '\nRISK ASSESSMENT\n'; addF('cardiovascularRiskScore'); }
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  const getStageColor = (stage) => { if (!stage) return '#10b981'; const l = stage.toLowerCase(); if (l.includes('crisis') || l.includes('stage 2')) return '#ef4444'; if (l.includes('stage 1')) return '#f59e0b'; if (l.includes('elevated')) return '#3b82f6'; return '#10b981'; };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="blood-pressure-readings-document"><header className="document-header"><h1 className="document-title">Blood Pressure Readings</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="blood-pressure-readings-document">
      <header className="document-header">
        <h1 className="document-title">Blood Pressure Readings</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BloodPressureReadingsDocumentPDFTemplate document={pdfData} />} fileName="Blood_Pressure_Readings.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">
                {record.ahaStageClassification && <span className="status-badge" style={{ background: `${getStageColor(record.ahaStageClassification)}22`, color: getStageColor(record.ahaStageClassification), border: `1px solid ${getStageColor(record.ahaStageClassification)}66` }}>{highlightText(record.ahaStageClassification)}</span>}
                {(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Blood Pressure Reading ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'bpReading', 'Blood Pressure Reading', ['systolicPressure', 'diastolicPressure', 'heartRate', 'meanArterialPressure', 'pulseWidth'])}
            {renderMultiFieldSection(record, idx, 'measurement', 'Measurement Details', ['measurementPosition', 'cuffSize', 'measurementArm'])}
            {renderMultiFieldSection(record, idx, 'classification', 'Classification', ['ahaStageClassification', 'hypertensiveCrisis'])}
            {renderMultiFieldSection(record, idx, 'orthostatic', 'Orthostatic Assessment', ['orthostaticMeasurement', 'orthostaticSystolic', 'orthostaticDiastolic'])}
            {renderMultiFieldSection(record, idx, 'vascular', 'Vascular Assessment', ['ankleBrachialIndex', 'toeBrachialIndex', 'centralAorticPressure', 'augmentationIndex', 'pulseWaveVelocity'])}
            {renderMultiFieldSection(record, idx, 'monitoring', 'Monitoring Status', ['ambulatoryMonitoring', 'homeMonitoring', 'whiteCoatEffect', 'maskedHypertension'])}

            {/* Medications */}
            {record.antihypertensiveMedications?.length > 0 && shouldShowSection(record, 'Medications', record.antihypertensiveMedications, ['antihypertensiveMedications']) && renderSection(record, idx, 'medications', 'Medications', (() => { const stm = sectionTitleMatches('Medications'); const sa = !searchTerm.trim() || record._showAllSections || stm; return record.antihypertensiveMedications.map((item, ai) => { const val = localEdits[`antihypertensiveMedications-${idx}-${ai}`] !== undefined ? localEdits[`antihypertensiveMedications-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, 'antihypertensiveMedications', idx, 'medications', item, ai); }).filter(Boolean); })())}

            {renderMultiFieldSection(record, idx, 'risk', 'Risk Assessment', ['cardiovascularRiskScore'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BloodPressureReadingsDocument;
