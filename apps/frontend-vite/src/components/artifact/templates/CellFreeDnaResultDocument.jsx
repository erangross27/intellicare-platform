/**
 * CellFreeDnaResultDocument.jsx
 * March 2026 blue glow theme with inline editing.
 * Flat fields + 1 array. Collection: cell_free_dna_result
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import CellFreeDnaResultDocumentPDFTemplate from '../pdf-templates/CellFreeDnaResultDocumentPDFTemplate';
import './CellFreeDnaResultDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'cell_free_dna_resultPendingEdits';
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
  trisomy: ['trisomy21Risk', 'trisomy18Risk', 'trisomy13Risk', 'sexChromosomeAneuploidyRisk'],
  fetalSex: ['fetalSexDetermination', 'yChromosomeDetected'],
  dna: ['cfDnaConcentration', 'cfDnaIntegrity', 'fetalFraction'],
  zScores: ['zScoreChromosome21', 'zScoreChromosome18', 'zScoreChromosome13'],
  testing: ['gestationalAgeAtTesting', 'testMethodology', 'laboratoryAccreditation'],
  maternal: ['maternalAge', 'maternalBMI'],
  quality: ['sequenceReads', 'mappedReads', 'qualityScore'],
  microdeletion: ['microdeletionScreening'],
  status: ['testFailureReason', 'redrawRecommendation', 'invasiveDiagnosticRecommended'],
};
const FIELD_LABELS = {
  trisomy21Risk: 'Trisomy 21 (Down Syndrome)', trisomy18Risk: 'Trisomy 18 (Edwards Syndrome)', trisomy13Risk: 'Trisomy 13 (Patau Syndrome)', sexChromosomeAneuploidyRisk: 'Sex Chromosome Aneuploidy',
  fetalSexDetermination: 'Fetal Sex', yChromosomeDetected: 'Y Chromosome Detected',
  cfDnaConcentration: 'cfDNA Concentration', cfDnaIntegrity: 'cfDNA Integrity', fetalFraction: 'Fetal Fraction',
  zScoreChromosome21: 'Z-Score Chromosome 21', zScoreChromosome18: 'Z-Score Chromosome 18', zScoreChromosome13: 'Z-Score Chromosome 13',
  gestationalAgeAtTesting: 'Gestational Age', testMethodology: 'Test Methodology', laboratoryAccreditation: 'Laboratory Accreditation',
  maternalAge: 'Maternal Age', maternalBMI: 'Maternal BMI',
  sequenceReads: 'Sequence Reads', mappedReads: 'Mapped Reads', qualityScore: 'Quality Score',
  microdeletionScreening: 'Microdeletion Screening',
  testFailureReason: 'Failure Reason', redrawRecommendation: 'Redraw Recommendation', invasiveDiagnosticRecommended: 'Invasive Diagnostic Recommended',
};
const ARRAY_FIELDS = ['microdeletionScreening'];
const NUMBER_FIELDS = ['cfDnaConcentration', 'cfDnaIntegrity', 'fetalFraction', 'zScoreChromosome21', 'zScoreChromosome18', 'zScoreChromosome13', 'maternalAge', 'maternalBMI', 'sequenceReads', 'mappedReads', 'qualityScore'];
const BOOLEAN_FIELDS = ['yChromosomeDetected', 'redrawRecommendation', 'invasiveDiagnosticRecommended'];
// Fixed-choice fields edit via dropdown; option casing matches the stored values ("low risk", "female").
const RISK_LEVELS = ['low risk', 'medium risk', 'high risk', 'very high risk'];
const ENUM_FIELDS = {
  trisomy21Risk: RISK_LEVELS, trisomy18Risk: RISK_LEVELS, trisomy13Risk: RISK_LEVELS, sexChromosomeAneuploidyRisk: RISK_LEVELS,
  fetalSexDetermination: ['female', 'male'],
};
const COPY_LINE_EQ = '='.repeat(40);
const COPY_LINE_DASH = '-'.repeat(40);
const stepFor = (v) => { const d = String(v ?? '').split('.')[1]; return d ? '0.' + '0'.repeat(Math.max(0, d.length - 1)) + '1' : '1'; };

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'boolean') return true; if (typeof v === 'number') return v !== 0; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

const CellFreeDnaResultDocument = ({ document: rawDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [localEdits, setLocalEdits] = useState({});
  const [editedFields, setEditedFields] = useState({});
  const [approvedSections, setApprovedSections] = useState({});
  // editKeys that are staged drafts (saved locally, NOT yet committed to DB/PDF). Cleared on Approve.
  const [pendingEdits, setPendingEdits] = useState({});

  const records = useMemo(() => {
    if (!rawDoc) return [];
    let arr = Array.isArray(rawDoc) ? rawDoc : [rawDoc];
    arr = arr.flatMap(r => {
      if (r?.cell_free_dna_result) return Array.isArray(r.cell_free_dna_result) ? r.cell_free_dna_result : [r.cell_free_dna_result];
      if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.cell_free_dna_result) return Array.isArray(dd.cell_free_dna_result) ? dd.cell_free_dna_result : [dd.cell_free_dna_result]; return [dd]; }
      return r;
    });
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
        // fieldPart = "field" or "field.arrayIndex"; map to this file's editKey convention.
        const lastDot = fieldPart.lastIndexOf('.');
        const isArr = lastDot !== -1 && /^\d+$/.test(fieldPart.slice(lastDot + 1));
        const editKey = isArr
          ? `${fieldPart.slice(0, lastDot)}-${idx}-${fieldPart.slice(lastDot + 1)}`
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
  const getEffectiveArray = useCallback((record, fieldName, idx) => { const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : []; original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek]; }); return original; }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CellFreeDnaResult] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    // Re-edit after approval → drop the section 'approved' flag so the button goes back to yellow Pending Approve
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CellFreeDnaResult] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`;
    setLocalEdits(prev => ({ ...prev, [ek]: editValue }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = editValue;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this record's section to MongoDB, then clear pending so the
  // committed values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    const rid = getRecordId(record); if (!rid) return;
    const sf = SECTION_FIELDS[sid] || [];
    // Collect this record+section's pending edits (editKey = "field-idx" or "field-idx-arrayIndex").
    const toCommit = Object.keys(localEdits).filter(k => {
      if (!pendingEdits[k]) return false;
      const parts = k.split('-');
      // last numeric segment may be arrayIndex; the one before it (or last) is idx
      let field, recIdx;
      const last = parts[parts.length - 1];
      const prev = parts[parts.length - 2];
      if (parts.length >= 3 && /^\d+$/.test(last) && /^\d+$/.test(prev)) {
        recIdx = parseInt(prev, 10); field = parts.slice(0, -2).join('-');
      } else if (/^\d+$/.test(last)) {
        recIdx = parseInt(last, 10); field = parts.slice(0, -1).join('-');
      } else { return false; }
      return recIdx === idx && sf.includes(field);
    });
    setApproving(true);
    try {
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const ek of toCommit) {
        const parts = ek.split('-');
        const last = parts[parts.length - 1];
        const prev = parts[parts.length - 2];
        let payload;
        if (parts.length >= 3 && /^\d+$/.test(last) && /^\d+$/.test(prev)) {
          payload = { field: parts.slice(0, -2).join('-'), value: localEdits[ek], arrayIndex: parseInt(last, 10) };
        } else {
          payload = { field: parts.slice(0, -1).join('-'), value: localEdits[ek] };
        }
        await sc.put(`/api/edit/cell_free_dna_result/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/cell_free_dna_result/${rid}/approve`, { sectionId: sid, approved: true });

      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this record's committed section drafts from localStorage
      const store = readDrafts();
      if (store[rid]) {
        toCommit.forEach(ek => {
          const parts = ek.split('-');
          const last = parts[parts.length - 1];
          const prev = parts[parts.length - 2];
          const fieldPart = (parts.length >= 3 && /^\d+$/.test(last) && /^\d+$/.test(prev))
            ? `${parts.slice(0, -2).join('-')}.${last}`
            : parts.slice(0, -1).join('-');
          delete store[rid][fieldPart];
        });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }

      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`)) delete n[k]; }); }); return n; });
    }
    catch (err) { console.error('[CellFreeDnaResult] Approve failed:', err); }
    finally { setApproving(false); }
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
      const title = `Cell-Free DNA Result ${idx + 1}`;
      const allText = [title, formatDate(record.date || record.createdAt), ...Object.keys(FIELD_LABELS).map(f => fmtVal(record[f])), ...(Array.isArray(record.microdeletionScreening) ? record.microdeletionScreening : []), ...Object.values(FIELD_LABELS)].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`))); };
  const renderApproveButton = (record, idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" disabled={approving} onClick={(e) => { e.stopPropagation(); handleApproveSection(record, idx, sid); }}>{approving ? 'Approving...' : 'Pending Approve'}</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const handleSaveTypedField = useCallback((record, fn, idx, sid, typedValue) => {
    const rid = getRecordId(record); if (!rid) { console.error('[CellFreeDnaResult] Cannot save — no record ID'); return; }
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

  const renderBooleanField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = raw ? 'Yes' : 'No'; const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><select className="edit-select" value={editValue} onChange={e => setEditValue(e.target.value)} autoFocus onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}><option value="Yes">Yes</option><option value="No">No</option></select><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveTypedField(record, fn, idx, sid, editValue === 'Yes')} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNumberField = (record, fn, idx, sid, showLabel = true) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const saveNum = () => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveTypedField(record, fn, idx, sid, n); };
    const stepVal = parseFloat(stepFor(raw)) || 1;
    const stepDecs = (String(stepVal).split('.')[1] || '').length;
    const stepNum = (dir) => { const cur = parseFloat(editValue); setEditValue(((isNaN(cur) ? 0 : cur) + dir * stepVal).toFixed(stepDecs)); };
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><div className="num-stepper-row"><button type="button" className="num-step" onClick={() => stepNum(-1)} disabled={saving}>−</button><input type="number" step={stepFor(raw)} className="edit-number" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveNum(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus disabled={saving} /><button type="button" className="num-step" onClick={() => stepNum(1)} disabled={saving}>+</button></div><div className="edit-actions"><button className="save-btn" onClick={saveNum} disabled={saving || isNaN(parseFloat(editValue))}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableField = (record, fn, idx, sid, showLabel = true) => {
    if (BOOLEAN_FIELDS.includes(fn)) return renderBooleanField(record, fn, idx, sid, showLabel);
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid, showLabel);
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw); const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    const enumOpts = ENUM_FIELDS[fn];
    if (ie) return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container">
      {enumOpts ? (
        <select className="edit-select" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }}>
          {!enumOpts.some(o => o.toLowerCase() === String(editValue).trim().toLowerCase()) && editValue ? <option value={editValue}>{editValue}</option> : null}
          {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} />
      )}
      <div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card">{showLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderEditableArrayItem = (record, fn, idx, sid, item, ai) => {
    const ek = `${fn}-${idx}-${ai}`; const val = localEdits[ek] !== undefined ? localEdits[ek] : String(item || '');
    const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fn}-${idx}-${ai}`;
    if (ie) return (<React.Fragment key={ai}><div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveArrayItem(record, fn, idx, sid, ai); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveArrayItem(record, fn, idx, sid, ai)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></React.Fragment>);
    return (<React.Fragment key={ai}><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(val); }}><div className="row-content"><span className="content-value">{highlightText(val)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(val, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</React.Fragment>);
  };

  const pdfData = useMemo(() => {
    if (Object.keys(localEdits).length === 0) return records;
    return records.map((record, idx) => {
      const m = { ...record };
      Object.keys(localEdits).forEach(key => {
        if (pendingEdits[key]) return; // pending drafts stay OUT of the PDF until approved
        const ld = key.lastIndexOf('-'); if (ld === -1) return;
        const fn = key.substring(0, ld); const ri = parseInt(key.substring(ld + 1), 10);
        if (ri === idx && fn in record) m[fn] = localEdits[key];
      });
      ARRAY_FIELDS.forEach(field => {
        const original = Array.isArray(record[field]) ? [...record[field]] : [];
        original.forEach((_, ai) => {
          const ek = `${field}-${idx}-${ai}`;
          if (localEdits[ek] !== undefined && !pendingEdits[ek]) original[ai] = localEdits[ek];
        });
        m[field] = original;
      });
      return m;
    });
  }, [records, localEdits, pendingEdits]);

  const SECTION_TITLES = { trisomy: 'TRISOMY RISK ASSESSMENT', fetalSex: 'FETAL SEX DETERMINATION', dna: 'DNA ANALYSIS', zScores: 'Z-SCORES', testing: 'TESTING INFORMATION', maternal: 'MATERNAL INFORMATION', quality: 'QUALITY METRICS', microdeletion: 'MICRODELETION SCREENING', status: 'TEST STATUS' };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    const title = SECTION_TITLES[sid] || sid.toUpperCase();
    let text = `${title}\n${COPY_LINE_EQ}\n`;
    // single-name rule: label == section title → hide the label (title already shown)
    const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== title.toLowerCase();
    const addF = (fn) => { if (hasVal(pr[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(pr[fn])}\n\n`; } };
    const addArr = (fn) => { getEffectiveArray(pr, fn, idx).forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); };
    if (sid === 'microdeletion') { addArr('microdeletionScreening'); }
    else { (SECTION_FIELDS[sid] || []).forEach(addF); }
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = `CELL-FREE DNA RESULT\n${COPY_LINE_EQ}\n\n`;
    pdfData.forEach((r, idx) => {
      text += `Cell-Free DNA Result ${idx + 1}\n${COPY_LINE_EQ}\n`;
      if (r.date || r.createdAt) text += `${formatDate(r.date || r.createdAt)}\n`;
      let curTitle = '';
      const showLbl = (fn) => (FIELD_LABELS[fn] || fn).toLowerCase() !== curTitle.toLowerCase();
      const addF = (fn) => { if (hasVal(r[fn])) { if (showLbl(fn)) text += `${FIELD_LABELS[fn] || fn}\n${COPY_LINE_DASH}\n`; text += `1. ${fmtVal(r[fn])}\n\n`; } };
      const addArr = (title, fn) => { const items = getEffectiveArray(r, fn, idx); if (items.length) { text += `\n${title}\n${COPY_LINE_EQ}\n`; items.forEach((it, i) => { text += `${i + 1}. ${it}\n`; }); } };
      const simpleFs = (title, fields) => { const vis = fields.filter(f => hasVal(r[f])); if (vis.length) { curTitle = title; text += `\n${title}\n${COPY_LINE_EQ}\n`; vis.forEach(addF); } };
      simpleFs('TRISOMY RISK ASSESSMENT', SECTION_FIELDS.trisomy);
      simpleFs('FETAL SEX DETERMINATION', SECTION_FIELDS.fetalSex);
      simpleFs('DNA ANALYSIS', SECTION_FIELDS.dna);
      simpleFs('Z-SCORES', SECTION_FIELDS.zScores);
      simpleFs('TESTING INFORMATION', SECTION_FIELDS.testing);
      simpleFs('MATERNAL INFORMATION', SECTION_FIELDS.maternal);
      simpleFs('QUALITY METRICS', SECTION_FIELDS.quality);
      addArr('MICRODELETION SCREENING', 'microdeletionScreening');
      simpleFs('TEST STATUS', SECTION_FIELDS.status);
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(record, idx, sid)}</div></div>{children}</div></div>); };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => hasVal(getFieldValue(record, f, idx)));
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; const sl = (FIELD_LABELS[f] || f).toLowerCase() !== title.toLowerCase(); return <React.Fragment key={f}>{renderEditableField(record, f, idx, sid, sl)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; const visibleItems = items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); return visibleItems.length > 0 ? <div className="rec-mini-card">{visibleItems}</div> : null; })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="cell-free-dna-result-document"><header className="document-header"><h1 className="document-title">Cell-Free DNA Result</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="cell-free-dna-result-document">
      <header className="document-header">
        <h1 className="document-title">Cell-Free DNA Result</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<CellFreeDnaResultDocumentPDFTemplate document={pdfData} />} fileName="Cell_Free_DNA_Result.pdf">
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
                {(record.date || record.createdAt) && <span className="record-date">{highlightText(formatDate(record.date || record.createdAt))}</span>}
              </div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Cell-Free DNA Result ${idx + 1}`)}</h3></div>
            </div>
            {renderMultiFieldSection(record, idx, 'trisomy', 'Trisomy Risk Assessment', SECTION_FIELDS.trisomy)}
            {renderMultiFieldSection(record, idx, 'fetalSex', 'Fetal Sex Determination', SECTION_FIELDS.fetalSex)}
            {renderMultiFieldSection(record, idx, 'dna', 'DNA Analysis', SECTION_FIELDS.dna)}
            {renderMultiFieldSection(record, idx, 'zScores', 'Z-Scores', SECTION_FIELDS.zScores)}
            {renderMultiFieldSection(record, idx, 'testing', 'Testing Information', SECTION_FIELDS.testing)}
            {renderMultiFieldSection(record, idx, 'maternal', 'Maternal Information', SECTION_FIELDS.maternal)}
            {renderMultiFieldSection(record, idx, 'quality', 'Quality Metrics', SECTION_FIELDS.quality)}
            {renderArraySection(record, idx, 'microdeletion', 'Microdeletion Screening', 'microdeletionScreening')}
            {renderMultiFieldSection(record, idx, 'status', 'Test Status', SECTION_FIELDS.status)}
          </div>
        ))}
      </div>
    </article>
  );
};

export default CellFreeDnaResultDocument;
