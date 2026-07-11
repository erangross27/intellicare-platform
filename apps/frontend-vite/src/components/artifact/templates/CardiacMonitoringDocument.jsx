/**
 * CardiacMonitoringDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 * No type conversion — always saves raw text.
 * Collection: cardiac_monitoring
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CardiacMonitoringDocumentPDFTemplate from '../pdf-templates/CardiacMonitoringDocumentPDFTemplate';
import './CardiacMonitoringDocument.css';

const SECTION_FIELDS = {
  rhythm: ['rhythmType', 'heartRate', 'nyhaClass'],
  bp: ['systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure'],
  hemodynamics: ['centralVenousPressure', 'pulmonaryArterPressure', 'pulmonaryWedgePressure', 'cardiacOutput', 'cardiacIndex', 'strokeVolume', 'ejectionFraction', 'svr', 'pvr'],
  ecg: ['stSegmentChanges', 'qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth'],
  pacing: ['pacingMode', 'pacingRate'],
  events: ['arrhythmiaEvents', 'icdTherapies', 'telemetryAlarms'],
};
const FIELD_LABELS = {
  rhythmType: 'Rhythm Type', heartRate: 'Heart Rate', nyhaClass: 'NYHA Class',
  systolicBloodPressure: 'Systolic BP', diastolicBloodPressure: 'Diastolic BP', meanArterialPressure: 'Mean Arterial Pressure',
  centralVenousPressure: 'CVP', pulmonaryArterPressure: 'Pulmonary Artery Pressure', pulmonaryWedgePressure: 'PCWP',
  cardiacOutput: 'Cardiac Output', cardiacIndex: 'Cardiac Index', strokeVolume: 'Stroke Volume',
  ejectionFraction: 'Ejection Fraction', svr: 'SVR', pvr: 'PVR',
  stSegmentChanges: 'ST Segment Changes', qtInterval: 'QT Interval', qtcInterval: 'QTc Interval',
  prInterval: 'PR Interval', qrsWidth: 'QRS Width',
  pacingMode: 'Pacing Mode', pacingRate: 'Pacing Rate',
  arrhythmiaEvents: 'Arrhythmia Events', icdTherapies: 'ICD Therapies', telemetryAlarms: 'Telemetry Alarms',
};
// NUMBER fields per schema — edited via number input, hide-zero
const NUMBER_FIELDS = new Set([
  'heartRate', 'systolicBloodPressure', 'diastolicBloodPressure', 'meanArterialPressure',
  'centralVenousPressure', 'pulmonaryWedgePressure', 'cardiacOutput', 'cardiacIndex',
  'strokeVolume', 'ejectionFraction', 'qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth',
  'svr', 'pvr', 'pacingRate',
]);
// ARRAY fields per schema — object/scalar array renderer
const ARRAY_FIELDS = new Set(['arrhythmiaEvents', 'icdTherapies', 'telemetryAlarms']);

const humanizeKey = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const fmtArrayItem = (it) => {
  if (it === null || it === undefined) return '';
  if (typeof it === 'object' && !Array.isArray(it)) {
    return Object.entries(it).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => `${humanizeKey(k)}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(', ');
  }
  if (Array.isArray(it)) return it.map(x => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ');
  if (typeof it === 'boolean') return it ? 'Yes' : 'No';
  return String(it);
};

// Number fields: zero is treated as blank (hide-zero)
const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const hasNumVal = (v) => { if (v === null || v === undefined || v === '') return false; const n = parseFloat(v); if (isNaN(n)) return typeof v === 'string' ? v.trim() !== '' : false; return n !== 0; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };
const splitBySentence = (text) => { if (!text) return []; return String(text).split(/[;.]\s+/).map(s => s.trim()).filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0); };
function reconstructFullText(sentences) { return sentences.map((s, i) => { const t = s.trim().replace(/[.;]+$/, ''); return i < sentences.length - 1 ? t + ';' : t; }).join(' '); }
const parseLabel = (text) => { const m = String(text || '').match(/^([A-Z][A-Za-z0-9\s/&(),-]+?):\s*(.*)/); return m ? { label: m[1], content: m[2] } : null; };

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cardiac_monitoringPendingEdits';
const readDrafts = () => {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { return {}; }
};
const writeDrafts = (store) => {
  try {
    if (store && Object.keys(store).length > 0) localStorage.setItem(DRAFT_KEY, JSON.stringify(store));
    else localStorage.removeItem(DRAFT_KEY);
  } catch { /* ignore quota/availability errors */ }
};

const CardiacMonitoringDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => {
      if (r?.cardiac_monitoring) return Array.isArray(r.cardiac_monitoring) ? r.cardiac_monitoring : [r.cardiac_monitoring];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cardiac_monitoring) return Array.isArray(dd.cardiac_monitoring) ? dd.cardiac_monitoring : [dd.cardiac_monitoring]; return [dd]; }
      return r;
    });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const getFieldValue = useCallback((record, fn, idx) => { const k = `${fn}-${idx}`; if (localEdits[k] !== undefined) return localEdits[k]; return record[fn]; }, [localEdits]);
  const getRecordId = (r) => { const id = r._id; if (!id) return null; if (typeof id === 'string') return id; if (id.$oid) return id.$oid; return String(id); };
  const copyToClipboard = async (text, id) => { try { await navigator.clipboard.writeText(text); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); } catch {} };

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const rid = getRecordId(record);
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

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacMonitoring] Cannot save — no record ID'); return; }
    const val = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: val }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = val;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    setSaving(true);
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      // Pending edits for THIS record + THIS section. editKey = "field-idx" (no dotted/arrayIndex here).
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => pendingEdits[k] && k.endsWith(suffix) && sf.includes(k.slice(0, -suffix.length)));
      // Persist each staged field to the DB now (field, or field+arrayIndex when the trailing segment is numeric)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const trailing = dotIdx === -1 ? '' : fieldPart.slice(dotIdx + 1);
        const isArrIdx = dotIdx !== -1 && /^\d+$/.test(trailing);
        const payload = { field: isArrIdx ? fieldPart.slice(0, dotIdx) : fieldPart, value: localEdits[editKey] };
        if (isArrIdx) payload.arrayIndex = parseInt(trailing, 10);
        await sc.put(`/api/edit/cardiac_monitoring/${rid}/edit`, payload);
      }
      // Flag the section approved (audit trail)
      await sc.put(`/api/edit/cardiac_monitoring/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's committed fields from the localStorage draft store
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { delete store[rid][k.slice(0, -suffix.length)]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      const sf2 = SECTION_FIELDS[sid] || [];
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf2.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CardiacMonitoring] Approve failed:', err); } finally { setSaving(false); }
  }, [localEdits, pendingEdits]);

  // Save one sentence = stage a DRAFT (no DB write). localStorage keeps it across refresh; Approve commits it.
  const saveSentence = useCallback((record, fn, idx, sid, sentenceIdx, valueOverride) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CardiacMonitoring] Cannot save — no record ID'); return; }
    const currentVal = fmtVal(getFieldValue(record, fn, idx)); const currentSentences = splitBySentence(currentVal);
    const cleanNew = (valueOverride !== undefined ? valueOverride : editValue).trim();
    if (!cleanNew || cleanNew.replace(/[.!?;,]+/g, '').trim() === '') { currentSentences.splice(sentenceIdx, 1); }
    else { const cleanOld = (currentSentences[sentenceIdx] || '').trim(); if (cleanNew === cleanOld) { setEditingField(null); setEditValue(''); return; } currentSentences[sentenceIdx] = cleanNew; }
    const fullText = reconstructFullText(currentSentences);
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: fullText }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    const newSentences = splitBySentence(fullText); const originalCount = splitBySentence(fmtVal(record[fn])).length;
    const extraCount = newSentences.length - originalCount;
    setEditedFields(prev => { const n = { ...prev, [`${fn}-${idx}-s${sentenceIdx}`]: 'edited' }; for (let ei = 0; ei < extraCount; ei++) { n[`${fn}-${idx}-s${sentenceIdx + 1 + ei}`] = 'added'; } return n; });
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const k = `${sid}-${idx}`; if (!prev[k]) return prev; const n = { ...prev }; delete n[k]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = fullText;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue, localEdits, getFieldValue]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(fmtVal(getFieldValue(record, fn, idx)), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Cardiac Monitoring ${idx + 1}`;
      const allText = [title, ...Object.keys(FIELD_LABELS).map(f => ARRAY_FIELDS.has(f) ? arrItems(record[f]).map(fmtArrayItem).join(' ') : fmtVal(record[f])), ...Object.values(FIELD_LABELS), 'Rhythm & Rate', 'Blood Pressure', 'Hemodynamics', 'ECG Parameters', 'Pacing', 'Events & Alarms'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}-${idx}-s`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid) => {
    const isNum = NUMBER_FIELDS.has(fn);
    const raw = getFieldValue(record, fn, idx);
    if (isNum ? !hasNumVal(raw) : !hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) {
      if (isNum) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="number" step="any" className="edit-number" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { const n = parseFloat(editValue); if (!isNaN(n)) handleSaveField(record, fn, idx, sid, n); } if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveField(record, fn, idx, sid, n); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
      return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'stSegmentChanges' ? 3 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    }
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderArrayField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    const items = Array.isArray(raw) ? raw.filter(x => hasVal(x)) : (hasVal(raw) ? [raw] : []);
    if (items.length === 0) return null;
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek];
    const display = items.map(fmtArrayItem);
    if (searchTerm.trim() && !record._showAllSections && !sectionTitleMatches('Events & Alarms') && !phraseMatch([FIELD_LABELS[fn] || fn, ...display].join(' '), searchTerm)) return null;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus placeholder="One item per line" rows={Math.max(2, display.length)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => { const arr = editValue.split('\n').map(s => s.trim()).filter(s => s); handleSaveField(record, fn, idx, sid, arr); }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>{display.map((it, i) => (<div key={i} className={`numbered-row editable-row${ed ? ' modified' : ''}`} style={{ marginBottom: i < display.length - 1 ? 8 : 0 }} onClick={() => { setEditingField(ek); setEditValue(display.join('\n')); }}><div className="row-content"><span className="content-value">{highlightText(it)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `${ek}-${i}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(it, `${ek}-${i}`); }}>{copiedId === `${ek}-${i}` ? 'Copied' : 'Copy'}</button></div>))}{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { rhythm: 'RHYTHM & RATE', bp: 'BLOOD PRESSURE', hemodynamics: 'HEMODYNAMICS', ecg: 'ECG PARAMETERS', pacing: 'PACING', events: 'EVENTS & ALARMS' };

  const arrItems = (v) => Array.isArray(v) ? v.filter(x => hasVal(x)) : (hasVal(v) ? [v] : []);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    if (sid === 'ecg') {
      if (hasVal(pr.stSegmentChanges)) { text += 'ST Segment Changes:\n'; splitBySentence(fmtVal(pr.stSegmentChanges)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); }
      ['qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth'].forEach(f => { if (hasNumVal(pr[f])) text += `${FIELD_LABELS[f]}: ${fmtVal(pr[f])}\n`; });
    } else if (sid === 'events') {
      (SECTION_FIELDS.events).forEach(f => { const items = arrItems(pr[f]); if (items.length) { text += `${FIELD_LABELS[f]}:\n`; items.forEach((it, i) => { text += `${i + 1}. ${fmtArrayItem(it)}\n`; }); } });
    } else {
      (SECTION_FIELDS[sid] || []).forEach(f => { if (NUMBER_FIELDS.has(f) ? hasNumVal(pr[f]) : hasVal(pr[f])) text += `${FIELD_LABELS[f] || f}: ${fmtVal(pr[f])}\n`; });
    }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== CARDIAC MONITORING ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Cardiac Monitoring ${idx + 1}\n`;
      Object.entries(SECTION_TITLES).forEach(([sid, title]) => {
        if (sid === 'ecg') {
          const hasST = hasVal(r.stSegmentChanges); const ecgFs = ['qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth'].filter(f => hasNumVal(r[f]));
          if (hasST || ecgFs.length) { text += `\n${title}\n`; if (hasST) { text += 'ST Segment Changes:\n'; splitBySentence(fmtVal(r.stSegmentChanges)).forEach((s, i) => { text += `${i + 1}. ${s}\n`; }); } ecgFs.forEach(f => { text += `${FIELD_LABELS[f]}: ${fmtVal(r[f])}\n`; }); }
        } else if (sid === 'events') {
          const evFs = SECTION_FIELDS.events.filter(f => arrItems(r[f]).length);
          if (evFs.length) { text += `\n${title}\n`; evFs.forEach(f => { text += `${FIELD_LABELS[f]}:\n`; arrItems(r[f]).forEach((it, i) => { text += `${i + 1}. ${fmtArrayItem(it)}\n`; }); }); }
        } else {
          const fields = SECTION_FIELDS[sid] || []; const vis = fields.filter(f => NUMBER_FIELDS.has(f) ? hasNumVal(r[f]) : hasVal(r[f]));
          if (vis.length) { text += `\n${title}\n`; vis.forEach(f => { text += `${FIELD_LABELS[f] || f}: ${fmtVal(r[f])}\n`; }); }
        }
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const fieldHasVal = (record, f, idx) => { const v = getFieldValue(record, f, idx); if (ARRAY_FIELDS.has(f)) { const items = Array.isArray(v) ? v.filter(x => hasVal(x)) : (hasVal(v) ? [v] : []); return items.length > 0; } return NUMBER_FIELDS.has(f) ? hasNumVal(v) : hasVal(v); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => fieldHasVal(record, f, idx));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const raw = getFieldValue(record, fieldName, idx); if (!hasVal(raw)) return null;
    const sentences = splitBySentence(fmtVal(raw)); if (sentences.length === 0) return null;
    if (!shouldShowSection(record, title, sentences, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      return sentences.map((sent, si) => {
        if (!sa && !phraseMatch(sent, searchTerm)) return null;
        const sentKey = `${fieldName}-${idx}-s${si}`; const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-${fieldName}-${idx}-${si}`;
        const parsed = parseLabel(sent);
        const saveLbl = (label) => { saveSentence(record, fieldName, idx, sid, si, label ? `${label}: ${editValue}` : editValue); };
        if (ie) return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        const displayText = parsed ? parsed.content : sent;
        return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
      }).filter(Boolean);
    })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cardiac-monitoring-document"><header className="document-header"><h1 className="document-title">Cardiac Monitoring</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cardiac-monitoring-document">
      <header className="document-header">
        <h1 className="document-title">Cardiac Monitoring</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CardiacMonitoringDocumentPDFTemplate document={pdfData} />} fileName="Cardiac_Monitoring.pdf">
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
                {record.rhythmType && <span className="record-date">{highlightText(record.rhythmType)}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cardiac Monitoring ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'rhythm', 'Rhythm & Rate', SECTION_FIELDS.rhythm)}
            {renderMultiFieldSection(record, idx, 'bp', 'Blood Pressure', SECTION_FIELDS.bp)}
            {renderMultiFieldSection(record, idx, 'hemodynamics', 'Hemodynamics', SECTION_FIELDS.hemodynamics)}
            {/* ECG: stSegmentChanges as sentence-split, rest as editable fields */}
            {(() => {
              const ecgFields = ['qtInterval', 'qtcInterval', 'prInterval', 'qrsWidth'].filter(f => hasVal(getFieldValue(record, f, idx)));
              const hasST = hasVal(getFieldValue(record, 'stSegmentChanges', idx));
              if (!hasST && ecgFields.length === 0) return null;
              if (!shouldShowSection(record, 'ECG Parameters', [fmtVal(getFieldValue(record, 'stSegmentChanges', idx)), ...ecgFields.map(f => fmtVal(getFieldValue(record, f, idx)))], ['stSegmentChanges', ...ecgFields])) return null;
              return renderSection(record, idx, 'ecg', 'ECG Parameters', <>
                {hasST && (() => {
                  const sentences = splitBySentence(fmtVal(getFieldValue(record, 'stSegmentChanges', idx)));
                  if (sentences.length <= 1) return renderEditableField(record, 'stSegmentChanges', idx, 'ecg');
                  const stm = sectionTitleMatches('ECG Parameters'); const sa = !searchTerm.trim() || record._showAllSections || stm;
                  return <>{sentences.map((sent, si) => {
                    if (!sa && !phraseMatch(sent, searchTerm)) return null;
                    const sentKey = `stSegmentChanges-${idx}-s${si}`; const ie = editingField === sentKey; const ed = editedFields[sentKey]; const cid = `sent-st-${idx}-${si}`;
                    const parsed = parseLabel(sent);
                    const saveLbl = (label) => { saveSentence(record, 'stSegmentChanges', idx, 'ecg', si, label ? `${label}: ${editValue}` : editValue); };
                    if (ie) return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveLbl(parsed?.label); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => saveLbl(parsed?.label)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
                    const displayText = parsed ? parsed.content : sent;
                    return (<div key={si} className="rec-mini-card">{parsed && <div className="nested-subtitle">{highlightText(parsed.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(sentKey); setEditValue(parsed ? parsed.content : sent); }}><div className="row-content"><span className="content-value">{highlightText(displayText)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sent, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed === 'edited' && <div className="modified-badge">edited - click Pending Approve to save</div>}{ed === 'added' && <div className="modified-badge added">added - click Pending Approve to save</div>}</div>);
                  }).filter(Boolean)}</>;
                })()}
                {ecgFields.map(f => <React.Fragment key={f}>{renderEditableField(record, f, idx, 'ecg')}</React.Fragment>)}
              </>);
            })()}
            {renderMultiFieldSection(record, idx, 'pacing', 'Pacing', SECTION_FIELDS.pacing)}
            {(() => {
              const visibleFields = SECTION_FIELDS.events.filter(f => fieldHasVal(record, f, idx));
              if (visibleFields.length === 0) return null;
              if (!shouldShowSection(record, 'Events & Alarms', visibleFields.map(f => arrItems(getFieldValue(record, f, idx)).map(fmtArrayItem).join(' ')), visibleFields)) return null;
              const stm = sectionTitleMatches('Events & Alarms'); const sa = !searchTerm.trim() || record._showAllSections || stm;
              return renderSection(record, idx, 'events', 'Events & Alarms', <>{visibleFields.map(f => {
                if (!sa && !phraseMatch([FIELD_LABELS[f], ...arrItems(getFieldValue(record, f, idx)).map(fmtArrayItem)].join(' '), searchTerm)) return null;
                return <React.Fragment key={f}>{renderArrayField(record, f, idx, 'events')}</React.Fragment>;
              })}</>);
            })()}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CardiacMonitoringDocument;
