/**
 * BloodGlucoseLogsDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BloodGlucoseLogsPDFTemplate from '../pdf-templates/BloodGlucoseLogsPDFTemplate';
import './BloodGlucoseLogsDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = field name) */
const DRAFT_KEY = 'blood_glucose_logsPendingEdits';
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
  overview: ['glucoseValue', 'readingTime', 'mealTiming'],
  dosing: ['insulinDose', 'correctionFactor', 'carbRatio', 'carbohydrates'],
  lifestyle: ['exercise', 'symptoms'],
  notes: ['notes'],
};
const FIELD_LABELS = { glucoseValue: 'Glucose Value', readingTime: 'Reading Time', mealTiming: 'Meal Timing', insulinDose: 'Insulin Dose', correctionFactor: 'Correction Factor', carbRatio: 'Carb Ratio', carbohydrates: 'Carbohydrates', exercise: 'Exercise', symptoms: 'Symptoms', notes: 'Notes' };

/* Numeric fields edited with a <input type="number"> stepper (instead of a textarea).
   Values are stored as strings — bare ("162") or number+unit ("40 units in TPN",
   "0 (separate sliding scale)"). splitNumberUnit edits ONLY the number, keeps the prefix
   operator + unit as fixed affixes, and reassembles on save so the stored string format is
   preserved byte-for-byte (Copy / PDF / backend untouched). Returns null for non-numeric text,
   ranges ("140-180 mg/dL"), ratios ("1:15") or any unit containing a digit
   ("218 mg/dL (14-day average)") → those keep the normal textarea. */
const NUMBER_FIELDS = ['glucoseValue', 'insulinDose', 'correctionFactor', 'carbRatio', 'carbohydrates'];
const splitNumberUnit = (raw) => {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^([<>≤≥=~]*)\s*(-?\d+(?:\.\d+)?)(\s*)(\S.*)?$/);
  if (!m) return null;
  const unit = (m[4] || '').trim();
  if (/^[-–—]\s*\d/.test(unit)) return null;   // range ("140-180 mg/dL") → keep textarea
  if (/\d/.test(unit)) return null;            // unit has a digit ("mg/dL (14-day average)", "1:15") → keep textarea
  const decimals = (m[2].split('.')[1] || '').length;
  return { prefix: m[1] || '', number: m[2], sep: m[3] || '', unit, step: decimals > 0 ? Math.pow(10, -decimals) : 1 };
};

const BloodGlucoseLogsDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.blood_glucose_logs) return Array.isArray(r.blood_glucose_logs) ? r.blood_glucose_logs : [r.blood_glucose_logs]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.blood_glucose_logs) return Array.isArray(dd.blood_glucose_logs) ? dd.blood_glucose_logs : [dd.blood_glucose_logs]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  const formatDate = (d) => { if (!d) return ''; try { return new Date(d.$date || d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return String(d); } };
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
    const rid = getRecordId(record); if (!rid) { console.error('[BloodGlucoseLogs] Cannot save — no record ID'); return; }
    const value = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: value }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { if (!prev[`${sid}-${idx}`]) return prev; const n = { ...prev }; delete n[`${sid}-${idx}`]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = value;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record); if (!rid) return;
      const sc = (await import('../../../services/secureApiClient')).default;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k] || !k.endsWith(suffix)) return false;
        const fieldPart = k.slice(0, -suffix.length);
        const baseField = fieldPart.includes('.') ? fieldPart.split('.')[0] : fieldPart;
        return sf.includes(baseField);
      });
      // Persist each staged field to the DB now (field, or field+arrayIndex for array elements)
      for (const editKey of toCommit) {
        const fieldPart = editKey.slice(0, -suffix.length); // "field" or "field.arrayIndex"
        const lastDot = fieldPart.lastIndexOf('.');
        const tail = lastDot === -1 ? '' : fieldPart.slice(lastDot + 1);
        const isArrayIdx = lastDot !== -1 && /^\d+$/.test(tail);
        const payload = { field: isArrayIdx ? fieldPart.slice(0, lastDot) : fieldPart, value: localEdits[editKey] };
        if (isArrayIdx) payload.arrayIndex = parseInt(tail, 10);
        await sc.put(`/api/edit/blood_glucose_logs/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/blood_glucose_logs/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's drafts (for committed fields) from localStorage
      const store = readDrafts();
      if (store[rid]) { toCommit.forEach(k => { const fp = k.slice(0, -suffix.length); delete store[rid][fp]; }); if (Object.keys(store[rid]).length === 0) delete store[rid]; writeDrafts(store); }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BloodGlucoseLogs] Approve failed:', err); }
  }, [localEdits, pendingEdits]);

  const highlightText = (text) => { if (!text) return ''; const str = String(text); if (!searchTerm.trim()) return str; const esc = searchTerm.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const re = new RegExp(`(${esc})`, 'gi'); const p = str.split(re); if (p.length === 1) return str; return <>{p.map((x, i) => re.test(x) ? <mark key={i}>{x}</mark> : x)}</>; };
  const phraseMatch = (text, term) => { if (!term.trim()) return true; return String(text || '').toLowerCase().includes(term.toLowerCase().trim()); };
  const shouldShowSection = (record, title, contentParts, fieldNames) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; const sl = searchTerm.toLowerCase().trim(); const tl = (title || '').toLowerCase(); if (tl.startsWith(sl) || sl.startsWith(tl)) return true; const labels = (fieldNames || []).map(f => FIELD_LABELS[f] || f); const combined = [...labels, ...(Array.isArray(contentParts) ? contentParts : [contentParts])].filter(Boolean).join(' '); return phraseMatch(combined, searchTerm); };
  const sectionTitleMatches = (t) => { if (!searchTerm.trim()) return false; const sl = searchTerm.toLowerCase().trim(); const tl = (t || '').toLowerCase(); return tl.startsWith(sl) || sl.startsWith(tl); };
  const fieldMatches = (record, fn, idx) => { if (!searchTerm.trim()) return true; if (record._showAllSections) return true; return phraseMatch(FIELD_LABELS[fn] || fn, searchTerm) || phraseMatch(getFieldValue(record, fn, idx), searchTerm); };

  const filteredRecords = useMemo(() => {
    if (!searchTerm.trim()) return records;
    const sl = searchTerm.toLowerCase().trim();
    return records.filter((record, idx) => {
      const title = `Blood Glucose Log ${idx + 1}`;
      const allText = [title, formatDate(record.date), record.glucoseValue, record.readingTime, record.mealTiming, record.insulinDose, record.correctionFactor, record.carbRatio, record.carbohydrates, record.exercise, record.symptoms, record.notes, ...Object.values(FIELD_LABELS), 'Glucose Overview', 'Insulin & Dosing', 'Activity & Symptoms', 'Notes'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const value = getFieldValue(record, fn, idx); if (!value && value !== false && !localEdits[`${fn}-${idx}`]) return null;
    const dv = typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value || '');
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    // Numeric fields → edit the number with a <input type="number"> stepper (keep prefix/unit fixed);
    // non-numeric values (ranges, ratios, free text) fall back to the textarea.
    const nu = NUMBER_FIELDS.includes(fn) ? splitNumberUnit(dv) : null;
    const saveNumber = () => { const t = editValue.trim(); if (t === '' || isNaN(parseFloat(t))) return; handleSaveField(record, fn, idx, sid, `${nu.prefix}${t}${nu.sep}${nu.unit}`); };
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">{nu ? (<div className="num-unit-edit">{nu.prefix && <span className="nu-affix">{nu.prefix}</span>}<input type="number" className="edit-number" step={nu.step} value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNumber(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} />{nu.unit && <span className="nu-affix">{nu.unit}</span>}</div>) : (<textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'notes' ? 4 : 1} disabled={saving} />)}<div className="edit-actions"><button className="save-btn" onClick={() => nu ? saveNumber() : handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(nu ? nu.number : dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  /* Notes display: split by sentence, with embedded "Label:" subtitles */
  const splitIntoSentences = (text) => { if (!text) return []; return text.split(/(?<=[.!?;])\s+/).filter(s => s.trim() && s.trim().replace(/[.!?;,]+/g, '').trim().length > 0).map(s => s.trim().replace(/;$/, '')); };
  const parseEmbeddedSubtitle = (sentence) => { const ci = sentence.indexOf(':'); if (ci === -1 || ci > 50) return null; const label = sentence.substring(0, ci).trim(); const rest = sentence.substring(ci + 1).trim(); if (!rest) return null; const items = rest.split(/,\s*/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean); if (items.length < 2) return null; return { label, items }; };

  const renderNotesSection = (record, idx) => {
    const notesVal = String(getFieldValue(record, 'notes', idx) || '');
    if (!notesVal.trim()) return null;
    if (!shouldShowSection(record, 'Notes', [notesVal], ['notes'])) return null;
    const sentences = splitIntoSentences(notesVal);
    const stm = sectionTitleMatches('Notes');
    const sa = !searchTerm.trim() || record._showAllSections || stm;
    const ek = `notes-${idx}`; const ed = editedFields[ek]; const ie = editingField === ek;

    const buildCopyText = () => {
      const pr = pdfData[idx] || record; const nv = String(pr.notes || ''); const sents = splitIntoSentences(nv);
      const parts = []; let num = 1;
      sents.forEach(s => { const parsed = parseEmbeddedSubtitle(s); if (parsed) { parts.push(`\n${parsed.label}:`); parsed.items.forEach((item, j) => parts.push(`  ${j + 1}. ${item}`)); } else { parts.push(`${num}. ${s}`); num++; } });
      return parts.join('\n');
    };

    return (
      <div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText('Notes')}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-notes-${idx}` ? ' copied' : ''}`} onClick={() => copyToClipboard(buildCopyText(), `section-notes-${idx}`)}>{copiedId === `section-notes-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, 'notes')}</div></div>
        {ie ? (<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, 'notes', idx, 'notes'); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={4} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, 'notes', idx, 'notes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div>) : (
          sentences.map((sentence, si) => {
            const parsed = parseEmbeddedSubtitle(sentence);
            if (parsed) {
              const visible = sa || phraseMatch(parsed.label, searchTerm) || parsed.items.some(item => phraseMatch(item, searchTerm));
              if (!visible) return null;
              return (<div key={`sub-${si}`} className="rec-mini-card"><div className="nested-subtitle">{highlightText(parsed.label)}</div>{parsed.items.map((item, ii) => (<div key={ii} className="numbered-row" style={{ marginBottom: ii < parsed.items.length - 1 ? '8px' : '0' }}><div className="row-content"><span className="content-value">{highlightText(item)}</span></div><button className={`copy-btn${copiedId === `note-sub-${idx}-${si}-${ii}` ? ' copied' : ''}`} onClick={() => copyToClipboard(item, `note-sub-${idx}-${si}-${ii}`)}>{copiedId === `note-sub-${idx}-${si}-${ii}` ? 'Copied' : 'Copy'}</button></div>))}</div>);
            }
            if (!sa && !phraseMatch(sentence, searchTerm)) return null;
            return (<div key={`s-${si}`} className="rec-mini-card"><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(notesVal); }}><div className="row-content"><span className="content-value">{highlightText(sentence)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === `note-${idx}-${si}` ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(sentence, `note-${idx}-${si}`); }}>{copiedId === `note-${idx}-${si}` ? 'Copied' : 'Copy'}</button></div></div>);
          }).filter(Boolean)
        )}
        {!ie && ed && <div className="modified-badge">edited - click Pending Approve to save</div>}
      </div></div>
    );
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => { const m = { ...record }; Object.keys(localEdits).forEach(key => { if (pendingEdits[key]) return; const ld = key.lastIndexOf('-'); if (ld === -1) return; const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10); if (ri === idx && fn in record) m[fn] = localEdits[key]; }); return m; });
  }, [records, localEdits, pendingEdits]);

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record; let text = '';
    if (sid === 'overview') { if (pr.glucoseValue) text += `Glucose Value: ${pr.glucoseValue}\n`; if (pr.readingTime) text += `Reading Time: ${pr.readingTime}\n`; if (pr.mealTiming) text += `Meal Timing: ${pr.mealTiming}\n`; }
    else if (sid === 'dosing') { if (pr.insulinDose) text += `Insulin Dose: ${pr.insulinDose}\n`; if (pr.correctionFactor) text += `Correction Factor: ${pr.correctionFactor}\n`; if (pr.carbRatio) text += `Carb Ratio: ${pr.carbRatio}\n`; if (pr.carbohydrates) text += `Carbohydrates: ${pr.carbohydrates}\n`; }
    else if (sid === 'lifestyle') { if (pr.exercise) text += `Exercise: ${pr.exercise}\n`; if (pr.symptoms) text += `Symptoms: ${pr.symptoms}\n`; }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BLOOD GLUCOSE LOGS ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Blood Glucose Log ${idx + 1}\n`;
      if (r.date) text += `${formatDate(r.date)}\n`;
      const ov = ['glucoseValue', 'readingTime', 'mealTiming'].filter(f => r[f]); if (ov.length > 0) { text += '\nGLUCOSE OVERVIEW\n'; ov.forEach(f => { text += `${FIELD_LABELS[f]}: ${r[f]}\n`; }); }
      const ds = ['insulinDose', 'correctionFactor', 'carbRatio', 'carbohydrates'].filter(f => r[f]); if (ds.length > 0) { text += '\nINSULIN & DOSING\n'; ds.forEach(f => { text += `${FIELD_LABELS[f]}: ${r[f]}\n`; }); }
      const ls = ['exercise', 'symptoms'].filter(f => r[f]); if (ls.length > 0) { text += '\nACTIVITY & SYMPTOMS\n'; ls.forEach(f => { text += `${FIELD_LABELS[f]}: ${r[f]}\n`; }); }
      if (r.notes) { text += '\nNOTES\n'; const sents = splitIntoSentences(r.notes); let num = 1; sents.forEach(s => { const parsed = parseEmbeddedSubtitle(s); if (parsed) { text += `\n${parsed.label}:\n`; parsed.items.forEach((item, j) => { text += `  ${j + 1}. ${item}\n`; }); } else { text += `${num}. ${s}\n`; num++; } }); }
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

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="blood-glucose-logs-document"><header className="document-header"><h1 className="document-title">Blood Glucose Logs</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="blood-glucose-logs-document">
      <header className="document-header">
        <h1 className="document-title">Blood Glucose Logs</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BloodGlucoseLogsPDFTemplate records={pdfData} />} fileName="Blood_Glucose_Logs.pdf">
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
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Blood Glucose Log ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'overview', 'Glucose Overview', ['glucoseValue', 'readingTime', 'mealTiming'])}
            {renderMultiFieldSection(record, idx, 'dosing', 'Insulin & Dosing', ['insulinDose', 'correctionFactor', 'carbRatio', 'carbohydrates'])}
            {renderMultiFieldSection(record, idx, 'lifestyle', 'Activity & Symptoms', ['exercise', 'symptoms'])}
            {renderNotesSection(record, idx)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BloodGlucoseLogsDocument;
