/**
 * BoneMarrowStudiesDocument.jsx
 * Inline editing with per-section approve, per-row copy.
 * 4-level search, PDFDownloadLink + pdfData memo, secureApiClient.
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import SearchBar from '../components/SearchBar';
import BoneMarrowStudiesDocumentPDFTemplate from '../pdf-templates/BoneMarrowStudiesDocumentPDFTemplate';
import './BoneMarrowStudiesDocument.css';

/* Pending-edit DRAFT store (localStorage). Drafts survive refresh + show in the JSX, but are NOT
   written to MongoDB and NOT shown in the PDF until the user clicks Approve.
   Kept in a SEPARATE key (NOT artifactGridData) so drafts never leak into the PDF/DB source.
   Shape: { [recordId]: { [fieldPart]: value } }  (fieldPart = "field" or "field.arrayIndex") */
const DRAFT_KEY = 'bone_marrow_studiesPendingEdits';
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
  procedure: ['procedureType', 'aspirationSite', 'indicationForStudy', 'coreBiopsyLength', 'specimenAdequacy'],
  cellularity: ['cellularity', 'blastPercentage', 'myeloidToErythroidRatio'],
  cellLines: ['erythroidSeries', 'myeloidSeries', 'megakaryocytes'],
  iron: ['ironStores', 'ringedSideroblasts'],
  flowCytometry: ['flowCytometryFindings'],
  cytogenetics: ['cytogeneticResults'],
  molecular: ['molecularStudies'],
  specialStains: ['specialStains'],
  diagnosis: ['pathologicDiagnosis'],
  morphology: ['dysplasticChanges', 'fibrosis'],
  complications: ['complications'],
  comparison: ['previousStudyDate'],
  providerInfo: ['provider', 'facility'],
};
const FIELD_LABELS = { procedureType: 'Procedure Type', aspirationSite: 'Aspiration Site', indicationForStudy: 'Indication for Study', coreBiopsyLength: 'Core Biopsy Length', specimenAdequacy: 'Specimen Adequacy', cellularity: 'Cellularity', blastPercentage: 'Blast Percentage', myeloidToErythroidRatio: 'M:E Ratio', erythroidSeries: 'Erythroid Series', myeloidSeries: 'Myeloid Series', megakaryocytes: 'Megakaryocytes', ironStores: 'Iron Stores', ringedSideroblasts: 'Ringed Sideroblasts', flowCytometryFindings: 'Flow Cytometry Findings', cytogeneticResults: 'Cytogenetic Results', pathologicDiagnosis: 'Pathologic Diagnosis', fibrosis: 'Fibrosis', previousStudyDate: 'Previous Study Date', provider: 'Provider', facility: 'Facility' };
const ARRAY_FIELDS = ['molecularStudies', 'specialStains', 'dysplasticChanges', 'complications'];
const NUMBER_FIELDS = ['blastPercentage'];
const DATE_FIELDS = ['previousStudyDate'];

const hasVal = (v) => { if (v === null || v === undefined || v === '') return false; if (typeof v === 'number') return true; if (typeof v === 'string') return v.trim() !== ''; if (Array.isArray(v)) return v.length > 0; return true; };
const fmtVal = (v) => { if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (typeof v === 'number') return String(v); return String(v || ''); };

/* Abbreviation-safe sentence split ("split by the dot") — does NOT break on Dr./Mr./St. etc. */
const ABBR_RE = '(?:Mr|Mrs|Ms|Dr|Prof|Rev|Sr|Jr|St|Gen|Col|Sgt|Lt|Capt|vs|etc)';
const splitBySentence = (text) => {
  if (!text) return [];
  return String(text)
    .split(new RegExp(`(?<!\\b${ABBR_RE}\\.)(?<=[.!?])\\s+`))
    .map(s => s.trim())
    .filter(s => s.length > 0 && s.replace(/[.!?;,]+/g, '').trim().length > 0);
};

/* parseLabel: "Label: value" → {isLabeled,label,value,prefix}; prefix keeps the exact "Label: " chars so
   prefix+value reproduces the item byte-for-byte (lossless edit). PAREN-AWARE: only a colon at paren-depth 0
   counts, so ratios inside parens ("(Kappa:Lambda ratio 15:1)") are NOT treated as a label; the space after
   the colon also rejects bare ratios/times like "15:1". Binds the first qualifying colon (label ≤ 80 chars). */
const parseLabel = (s) => {
  const str = String(s ?? ''); let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ':' && depth === 0) {
      const label = str.slice(0, i); const m = str.slice(i + 1).match(/^(\s+)(\S[\s\S]*)$/);
      if (m && label.trim().length >= 1 && label.length <= 80) return { isLabeled: true, label: label.trim(), value: m[2], prefix: str.slice(0, i + 1) + m[1] };
      return { isLabeled: false, label: '', value: str, prefix: '' };
    }
  }
  return { isLabeled: false, label: '', value: str, prefix: '' };
};

const BoneMarrowStudiesDocument = ({ document: rawDoc }) => {
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
    arr = arr.flatMap(r => { if (r?.bone_marrow_studies) return Array.isArray(r.bone_marrow_studies) ? r.bone_marrow_studies : [r.bone_marrow_studies]; if (r?.documentData) { const dd = r.documentData; if (Array.isArray(dd)) return dd; if (dd?.bone_marrow_studies) return Array.isArray(dd.bone_marrow_studies) ? dd.bone_marrow_studies : [dd.bone_marrow_studies]; return [dd]; } return r; });
    return arr.filter(r => r && typeof r === 'object');
  }, [rawDoc]);

  // Rehydrate pending drafts from localStorage so a Save survives refresh (shown in JSX, NOT in DB/PDF).
  useEffect(() => {
    const store = readDrafts();
    if (!store || Object.keys(store).length === 0) return;
    const nLocal = {}, nPending = {}, nFields = {};
    records.forEach((record, idx) => {
      const id = record && record._id ? (typeof record._id === 'string' ? record._id : (record._id.$oid || String(record._id))) : null;
      const recDrafts = id ? store[id] : null;
      if (!recDrafts) return;
      Object.entries(recDrafts).forEach(([fieldPart, value]) => {
        // fieldPart = "field" or "field.arrayIndex" → editKey uses dash convention "field-idx" / "field-idx-arrayIndex"
        const dotIdx = fieldPart.lastIndexOf('.');
        const isArr = dotIdx !== -1 && /^\d+$/.test(fieldPart.slice(dotIdx + 1));
        const editKey = isArr
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

  // includePending=false → exclude staged (not-yet-approved) array edits (used by pdfData/Copy so drafts stay out).
  const getEffectiveArray = useCallback((record, fieldName, idx, includePending = true) => {
    const original = Array.isArray(record[fieldName]) ? [...record[fieldName]] : [];
    original.forEach((_, ai) => { const ek = `${fieldName}-${idx}-${ai}`; if (localEdits[ek] !== undefined && (includePending || !pendingEdits[ek])) original[ai] = localEdits[ek]; });
    return original;
  }, [localEdits, pendingEdits]);

  // Save = stage a DRAFT locally + write it to the pending-drafts localStorage store (survives refresh).
  // NOT written to MongoDB and NOT shown in the PDF until the user clicks Approve (handleApproveSection commits).
  const handleSaveField = useCallback((record, fn, idx, sid, valueOverride, trackKey) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BoneMarrowStudies] Cannot save — no record ID'); return; }
    const valueToSave = valueOverride !== undefined ? valueOverride : editValue;
    const ek = `${fn}-${idx}`; const track = trackKey || ek;
    setLocalEdits(prev => ({ ...prev, [ek]: valueToSave }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [track]: 'edited' }));
    // Re-edit after approval → drop this section's 'approved' flag so the button goes back to yellow
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][fn] = valueToSave;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  const handleSaveArrayItem = useCallback((record, fn, idx, sid, arrayIndex, valueOverride) => {
    const rid = getRecordId(record);
    if (!rid) { console.error('[BoneMarrowStudies] Cannot save — no record ID'); return; }
    const ek = `${fn}-${idx}-${arrayIndex}`; const valueToSave = valueOverride !== undefined ? valueOverride : editValue;
    setLocalEdits(prev => ({ ...prev, [ek]: valueToSave }));
    setPendingEdits(prev => ({ ...prev, [ek]: true }));
    setEditedFields(prev => ({ ...prev, [ek]: 'edited' }));
    setApprovedSections(prev => { const key = `${sid}-${idx}`; if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });
    const store = readDrafts();
    if (!store[rid]) store[rid] = {};
    store[rid][`${fn}.${arrayIndex}`] = valueToSave;
    writeDrafts(store);
    setEditingField(null); setEditValue('');
  }, [editValue]);

  // Approve = COMMIT all staged drafts for this section to MongoDB, then clear pending so the committed
  // values now flow into pdfData/PDF. This is the ONLY path that writes to the database.
  const handleApproveSection = useCallback(async (record, idx, sid) => {
    try {
      const rid = getRecordId(record);
      if (!rid) return;
      const sf = SECTION_FIELDS[sid] || [];
      const suffix = `-${idx}`;
      // Collect this section's pending edits: editKey is "field-idx" or "field-idx-arrayIndex".
      const toCommit = Object.keys(localEdits).filter(k => {
        if (!pendingEdits[k]) return false;
        const di = k.lastIndexOf('-');
        if (di === -1) return false;
        const tail = k.slice(di + 1);
        // Array item: "field-idx-arrayIndex" → strip arrayIndex, then expect "field-idx"
        const base = /^\d+$/.test(tail) && k.slice(0, di).endsWith(suffix) ? k.slice(0, di) : k;
        const fieldPart = base.slice(0, -suffix.length);
        return base.endsWith(suffix) && sf.includes(fieldPart);
      });
      const sc = (await import('../../../services/secureApiClient')).default;
      for (const editKey of toCommit) {
        const di = editKey.lastIndexOf('-');
        const tail = editKey.slice(di + 1);
        // arrayIndex ONLY when trailing dash-segment is purely numeric AND the remainder ends with "-idx"
        const isArr = /^\d+$/.test(tail) && editKey.slice(0, di).endsWith(suffix);
        const fn = isArr ? editKey.slice(0, di).slice(0, -suffix.length) : editKey.slice(0, -suffix.length);
        const payload = { field: fn, value: localEdits[editKey] };
        if (isArr) payload.arrayIndex = parseInt(tail, 10);
        await sc.put(`/api/edit/bone_marrow_studies/${rid}/edit`, payload);
      }
      await sc.put(`/api/edit/bone_marrow_studies/${rid}/approve`, { sectionId: sid, approved: true });
      // Clear pending → committed edits now flow into pdfData/PDF
      setPendingEdits(prev => { const n = { ...prev }; toCommit.forEach(k => delete n[k]); return n; });
      // Drop this section's drafts from localStorage (now committed)
      const store = readDrafts();
      if (store[rid]) {
        sf.forEach(f => { delete store[rid][f]; Object.keys(store[rid]).forEach(fp => { if (fp.startsWith(`${f}.`)) delete store[rid][fp]; }); });
        if (Object.keys(store[rid]).length === 0) delete store[rid];
        writeDrafts(store);
      }
      setApprovedSections(prev => ({ ...prev, [`${sid}-${idx}`]: true }));
      setEditedFields(prev => { const n = { ...prev }; Object.keys(n).forEach(k => { sf.forEach(f => { if (k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`)) delete n[k]; }); }); return n; });
    } catch (err) { console.error('[BoneMarrowStudies] Approve failed:', err); }
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
      const title = `Bone Marrow Study ${idx + 1}`;
      const allText = [title, formatDate(record.studyDate || record.date), formatDate(record.previousStudyDate), record.procedureType, record.aspirationSite, record.indicationForStudy, record.cellularity, record.erythroidSeries, record.myeloidSeries, record.megakaryocytes, record.flowCytometryFindings, record.cytogeneticResults, record.pathologicDiagnosis, record.fibrosis, record.provider, record.facility, record.coreBiopsyLength, record.specimenAdequacy, ...(Array.isArray(record.specialStains) ? record.specialStains : []), ...(Array.isArray(record.molecularStudies) ? record.molecularStudies : []), ...Object.values(FIELD_LABELS), 'Procedure Information', 'Cellularity', 'Cell Lines', 'Iron Studies', 'Flow Cytometry', 'Cytogenetics', 'Molecular Studies', 'Special Stains', 'Pathologic Diagnosis', 'Morphology', 'Complications', 'Comparison', 'Provider Information'].filter(Boolean).join(' ');
      const match = allText.toLowerCase().includes(sl);
      record._showAllSections = match && title.toLowerCase().startsWith(sl);
      return match;
    });
  }, [records, searchTerm]);

  const sectionHasEdits = (idx, sid) => { const fs = SECTION_FIELDS[sid] || []; return fs.some(f => Object.keys(editedFields).some(k => k.startsWith(`${f}-${idx}`) || k.startsWith(`${f}.`))); };
  const renderApproveButton = (idx, sid) => { const he = sectionHasEdits(idx, sid); const ia = approvedSections[`${sid}-${idx}`]; if (he) return <button className="approve-btn pending" onClick={(e) => { e.stopPropagation(); handleApproveSection(records[idx], idx, sid); }}>Pending Approve</button>; if (ia) return <span className="approve-btn approved">Approved</span>; return null; };

  const renderEditableField = (record, fn, idx, sid, hideLabel) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = fmtVal(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSaveField(record, fn, idx, sid); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={fn === 'flowCytometryFindings' || fn === 'pathologicDiagnosis' ? 4 : 1} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={() => handleSaveField(record, fn, idx, sid)} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className={hideLabel ? undefined : 'rec-mini-card'}>{!hideLabel && <div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(dv); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const toInputDate = (v) => { if (!v) return ''; const d = new Date(v.$date || v); if (isNaN(d.getTime())) return ''; return d.toISOString().slice(0, 10); };

  const renderDateField = (record, fn, idx, sid, label) => {
    const raw = getFieldValue(record, fn, idx); if (!hasVal(raw)) return null;
    const dv = formatDate(raw);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label || FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="date" className="edit-input" value={editValue} onChange={e => setEditValue(e.target.value)} ref={el => { if (el) { el.focus(); try { el.showPicker(); } catch {} } }} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { const d = new Date(editValue); if (isNaN(d.getTime())) return; handleSaveField(record, fn, idx, sid, d.toISOString()); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
    return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(label || FIELD_LABELS[fn] || fn)}</div><div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(toInputDate(raw)); }}><div className="row-content"><span className="content-value">{highlightText(dv)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(dv, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
  };

  const renderNumberField = (record, fn, idx, sid) => {
    const raw = getFieldValue(record, fn, idx);
    const num = typeof raw === 'number' ? raw : (raw === '' || raw === null || raw === undefined ? NaN : parseFloat(raw));
    if (isNaN(num) || num === 0) return null;
    const dv = String(num);
    const ek = `${fn}-${idx}`; const ie = editingField === ek; const ed = editedFields[ek]; const cid = `row-${fn}-${idx}`;
    if (ie) return (<div className="rec-mini-card"><div className="nested-subtitle">{highlightText(FIELD_LABELS[fn] || fn)}</div><div className="edit-field-container"><input type="number" step="any" className="edit-input" value={editValue} autoFocus onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} disabled={saving} /><div className="edit-actions"><button className="save-btn" disabled={saving} onClick={() => { const n = parseFloat(editValue); if (isNaN(n)) return; handleSaveField(record, fn, idx, sid, n); }}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
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
      ARRAY_FIELDS.forEach(field => { m[field] = getEffectiveArray(record, field, idx, false); });
      return m;
    });
  }, [records, localEdits, pendingEdits, getEffectiveArray]);

  const SECTION_TITLES = { procedure: 'PROCEDURE INFORMATION', cellularity: 'CELLULARITY', cellLines: 'CELL LINES', iron: 'IRON STUDIES', flowCytometry: 'FLOW CYTOMETRY', cytogenetics: 'CYTOGENETICS', molecular: 'MOLECULAR STUDIES', specialStains: 'SPECIAL STAINS', diagnosis: 'PATHOLOGIC DIAGNOSIS', morphology: 'MORPHOLOGY', complications: 'COMPLICATIONS', comparison: 'COMPARISON', providerInfo: 'PROVIDER INFORMATION' };

  // Field visibility matching the JSX (NUMBER_FIELDS hide 0, like renderNumberField/renderMultiFieldSection).
  const fieldVisible = (r, f) => { if (NUMBER_FIELDS.includes(f)) { const n = parseFloat(r[f]); return !isNaN(n) && n !== 0; } return hasVal(r[f]); };
  // Build a section's items as {label?, value} mirroring the JSX cards (sentence-split flow, labeled special
  // stains, hidden fields excluded). formatItems numbers them and nests label:value (no inline "Label: value").
  const sectionItems = (r, idx, sid) => {
    const items = [];
    const addF = (f) => { if (fieldVisible(r, f)) items.push({ label: FIELD_LABELS[f] || f, value: fmtVal(r[f]) }); };
    const addArr = (f) => { getEffectiveArray(r, f, idx, false).forEach(it => items.push({ value: typeof it === 'object' ? (it.recommendation || '') : String(it) })); };
    const addLabeledArr = (f) => { getEffectiveArray(r, f, idx, false).forEach(it => { const p = parseLabel(String(it)); items.push(p.isLabeled ? { label: p.label, value: p.value } : { value: String(it) }); }); };
    const addSentences = (f) => { splitBySentence(fmtVal(r[f])).forEach(s => { const t = s.replace(/\.$/, ''); const p = parseLabel(t); items.push(p.isLabeled ? { label: p.label, value: p.value } : { value: t }); }); };
    if (sid === 'procedure') ['procedureType', 'aspirationSite', 'indicationForStudy', 'coreBiopsyLength', 'specimenAdequacy'].forEach(addF);
    else if (sid === 'cellularity') ['cellularity', 'blastPercentage', 'myeloidToErythroidRatio'].forEach(addF);
    else if (sid === 'cellLines') ['erythroidSeries', 'myeloidSeries', 'megakaryocytes'].forEach(addF);
    else if (sid === 'iron') ['ironStores', 'ringedSideroblasts'].forEach(addF);
    else if (sid === 'flowCytometry') { if (hasVal(r.flowCytometryFindings)) addSentences('flowCytometryFindings'); }
    else if (sid === 'cytogenetics') { if (hasVal(r.cytogeneticResults)) items.push({ value: fmtVal(r.cytogeneticResults) }); }
    else if (sid === 'molecular') addArr('molecularStudies');
    else if (sid === 'specialStains') addLabeledArr('specialStains');
    else if (sid === 'diagnosis') { if (hasVal(r.pathologicDiagnosis)) items.push({ value: fmtVal(r.pathologicDiagnosis) }); }
    else if (sid === 'morphology') { addArr('dysplasticChanges'); addF('fibrosis'); }
    else if (sid === 'complications') addArr('complications');
    else if (sid === 'comparison') { if (hasVal(r.previousStudyDate)) items.push({ label: FIELD_LABELS.previousStudyDate, value: formatDate(r.previousStudyDate) }); }
    else if (sid === 'providerInfo') ['provider', 'facility'].forEach(addF);
    return items;
  };
  // Numbered + nested: labeled → "N. Label:" then indented value; plain → "N. value". (Reflects JSX, no inline label:value.)
  const formatItems = (items) => { const lines = []; items.forEach((it, i) => { if (it.label) { lines.push(`${i + 1}. ${it.label}:`); lines.push(`   ${it.value}`); } else { lines.push(`${i + 1}. ${it.value}`); } }); return lines; };

  const copySectionText = (record, idx, sid) => {
    const pr = pdfData[idx] || record;
    let text = `${SECTION_TITLES[sid] || sid.toUpperCase()}\n`;
    formatItems(sectionItems(pr, idx, sid)).forEach(l => { text += `${l}\n`; });
    copyToClipboard(text.trim(), `section-${sid}-${idx}`);
  };

  const copyAllContent = () => {
    let text = '=== BONE MARROW STUDIES ===\n\n';
    pdfData.forEach((r, idx) => {
      text += `Bone Marrow Study ${idx + 1}\n`;
      if (r.studyDate || r.date) text += `${formatDate(r.studyDate || r.date)}\n`;
      Object.keys(SECTION_TITLES).forEach(sid => {
        const items = sectionItems(r, idx, sid);
        if (items.length) { text += `\n${SECTION_TITLES[sid]}\n`; formatItems(items).forEach(l => { text += `${l}\n`; }); }
      });
      text += '\n';
    });
    copyToClipboard(text.trim(), 'copy-all');
  };

  const renderSection = (record, idx, sid, title, children) => { if (!children) return null; return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>{children}</div></div>); };

  const renderFieldByType = (record, fn, idx, sid) => {
    if (NUMBER_FIELDS.includes(fn)) return renderNumberField(record, fn, idx, sid);
    if (DATE_FIELDS.includes(fn)) return renderDateField(record, fn, idx, sid);
    return renderEditableField(record, fn, idx, sid);
  };

  const renderMultiFieldSection = (record, idx, sid, title, fields) => {
    const visibleFields = fields.filter(f => {
      if (NUMBER_FIELDS.includes(f)) { const n = parseFloat(getFieldValue(record, f, idx)); return !isNaN(n) && n !== 0; }
      return hasVal(getFieldValue(record, f, idx));
    });
    if (visibleFields.length === 0) return null;
    if (!shouldShowSection(record, title, visibleFields.map(f => fmtVal(getFieldValue(record, f, idx))), visibleFields)) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return <>{visibleFields.map(f => { if (!sa && !fieldMatches(record, f, idx)) return null; return <React.Fragment key={f}>{renderFieldByType(record, f, idx, sid)}</React.Fragment>; })}</>; })());
  };

  const renderArraySection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => { const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm; return items.map((item, ai) => { const val = localEdits[`${fieldName}-${idx}-${ai}`] !== undefined ? localEdits[`${fieldName}-${idx}-${ai}`] : item; if (!sa && !phraseMatch(val, searchTerm)) return null; return renderEditableArrayItem(record, fieldName, idx, sid, item, ai); }).filter(Boolean); })());
  };

  /* SENTENCE-SPLIT section ("split by the dot"): one editable mini-card per sentence; save re-joins with '. '.
     Single sentence → the plain single-blob editor. */
  const renderSentenceSplitSection = (record, idx, sid, title, fieldName) => {
    const val = fmtVal(getFieldValue(record, fieldName, idx));
    if (!val.trim()) return null;
    if (!shouldShowSection(record, title, [val], [fieldName])) return null;
    const sentences = splitBySentence(val);
    if (sentences.length <= 1) return renderSection(record, idx, sid, title, renderEditableField(record, fieldName, idx, sid, true));
    const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
    return (<div className="section"><div className="mini-cards-container"><div className="section-header"><h4 className="section-title">{highlightText(title)}</h4><div className="header-right-actions"><button className={`copy-btn${copiedId === `section-${sid}-${idx}` ? ' copied' : ''}`} onClick={() => copySectionText(record, idx, sid)}>{copiedId === `section-${sid}-${idx}` ? 'Copied' : 'Copy Section'}</button>{renderApproveButton(idx, sid)}</div></div>
      {sentences.map((sentence, si) => {
        if (!sa && !phraseMatch(sentence, searchTerm)) return null;
        const partKey = `${fieldName}-${idx}-p${si}`; const isEditing = editingField === partKey; const isEdited = editedFields[partKey]; const cid = `${sid}-${idx}-${si}`;
        const displayText = sentence.replace(/\.$/, ''); const p = parseLabel(displayText); const rowText = p.isLabeled ? p.value : displayText;
        const saveSentence = () => { const parts = splitBySentence(fmtVal(getFieldValue(record, fieldName, idx))); parts[si] = p.isLabeled ? (p.prefix + editValue.trim()) : editValue.trim(); const newFull = parts.filter(x => x.trim().length > 0).map(x => x.replace(/\.$/, '')).join('. ') + '.'; handleSaveField(record, fieldName, idx, sid, newFull, partKey); };
        if (isEditing) return (<div key={si} className="rec-mini-card">{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveSentence(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveSentence} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        return (<div key={si} className="rec-mini-card">{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className={`numbered-row editable-row${isEdited ? ' modified' : ''}`} onClick={() => { setEditingField(partKey); setEditValue(rowText); }}><div className="row-content"><span className="content-value">{highlightText(rowText)}</span>{!isEdited && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(p.isLabeled ? `${p.label}\n${rowText}` : rowText, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{isEdited && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
      }).filter(Boolean)}
    </div></div>);
  };

  /* SPECIAL STAINS (array of "Label: value"): each item → nested-subtitle (label) + editable value; save reassembles
     `${label}: ${value}` losslessly. Unlabeled items keep the plain full-text editor. */
  const renderSpecialStainsSection = (record, idx, sid, title, fieldName) => {
    const items = Array.isArray(record[fieldName]) ? record[fieldName].filter(Boolean) : [];
    if (items.length === 0) return null;
    if (!shouldShowSection(record, title, items, [fieldName])) return null;
    return renderSection(record, idx, sid, title, (() => {
      const stm = sectionTitleMatches(title); const sa = !searchTerm.trim() || record._showAllSections || stm;
      return items.map((item, ai) => {
        const ek = `${fieldName}-${idx}-${ai}`; const cur = localEdits[ek] !== undefined ? String(localEdits[ek]) : String(item || '');
        if (!sa && !phraseMatch(cur, searchTerm)) return null;
        const p = parseLabel(cur); const ie = editingField === ek; const ed = editedFields[ek]; const cid = `arr-${fieldName}-${idx}-${ai}`;
        const saveItem = () => { const nv = p.isLabeled ? p.prefix + editValue.trim() : editValue.trim(); handleSaveArrayItem(record, fieldName, idx, sid, ai, nv); };
        if (ie) return (<div key={ai} className="rec-mini-card">{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className="edit-field-container"><textarea className="edit-textarea" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) saveItem(); if (e.key === 'Escape') { setEditingField(null); setEditValue(''); } }} autoFocus rows={2} disabled={saving} /><div className="edit-actions"><button className="save-btn" onClick={saveItem} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button><button className="cancel-btn" onClick={() => { setEditingField(null); setEditValue(''); }}>Cancel</button></div></div></div>);
        return (<div key={ai} className="rec-mini-card">{p.isLabeled && <div className="nested-subtitle">{highlightText(p.label)}</div>}<div className={`numbered-row editable-row${ed ? ' modified' : ''}`} onClick={() => { setEditingField(ek); setEditValue(p.isLabeled ? p.value : cur); }}><div className="row-content"><span className="content-value">{highlightText(p.isLabeled ? p.value : cur)}</span>{!ed && <span className="edit-indicator">✎</span>}</div><button className={`copy-btn${copiedId === cid ? ' copied' : ''}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(p.isLabeled ? `${p.label}\n${p.value}` : cur, cid); }}>{copiedId === cid ? 'Copied' : 'Copy'}</button></div>{ed && <div className="modified-badge">edited - click Pending Approve to save</div>}</div>);
      }).filter(Boolean);
    })());
  };

  if (!filteredRecords || filteredRecords.length === 0) return (<article className="bone-marrow-studies-document"><header className="document-header"><h1 className="document-title">Bone Marrow Studies</h1></header><SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} /><div className="empty-state">No data available.</div></article>);

  return (
    <article className="bone-marrow-studies-document">
      <header className="document-header">
        <h1 className="document-title">Bone Marrow Studies</h1>
        <div className="header-actions">
          <button className={`copy-btn${copiedId === 'copy-all' ? ' copied' : ''}`} onClick={copyAllContent}>{copiedId === 'copy-all' ? 'Copied' : 'Copy All'}</button>
          <PDFDownloadLink document={<BoneMarrowStudiesDocumentPDFTemplate document={pdfData} />} fileName="Bone_Marrow_Studies.pdf">
            {({ loading }) => <button className="copy-btn">{loading ? 'Preparing...' : 'Export PDF'}</button>}
          </PDFDownloadLink>
        </div>
      </header>
      <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="records-container">
        {filteredRecords.map((record, idx) => (
          <div key={idx} className="record-card">
            <div className="record-header">
              <div className="record-meta-row">{(record.studyDate || record.date) && <span className="record-date">{highlightText(formatDate(record.studyDate || record.date))}</span>}</div>
              <div className="record-title-row"><h3 className="record-name">{highlightText(`Bone Marrow Study ${idx + 1}`)}</h3></div>
            </div>

            {renderMultiFieldSection(record, idx, 'procedure', 'Procedure Information', ['procedureType', 'aspirationSite', 'indicationForStudy', 'coreBiopsyLength', 'specimenAdequacy'])}
            {renderMultiFieldSection(record, idx, 'cellularity', 'Cellularity', ['cellularity', 'blastPercentage', 'myeloidToErythroidRatio'])}
            {renderMultiFieldSection(record, idx, 'cellLines', 'Cell Lines', ['erythroidSeries', 'myeloidSeries', 'megakaryocytes'])}
            {renderMultiFieldSection(record, idx, 'iron', 'Iron Studies', ['ironStores', 'ringedSideroblasts'])}

            {/* Flow Cytometry — split by the dot (sentence rows) */}
            {renderSentenceSplitSection(record, idx, 'flowCytometry', 'Flow Cytometry', 'flowCytometryFindings')}

            {/* Cytogenetics */}
            {record.cytogeneticResults && shouldShowSection(record, 'Cytogenetics', [record.cytogeneticResults], ['cytogeneticResults']) && renderSection(record, idx, 'cytogenetics', 'Cytogenetics', renderEditableField(record, 'cytogeneticResults', idx, 'cytogenetics', true))}

            {renderArraySection(record, idx, 'molecular', 'Molecular Studies', 'molecularStudies')}
            {renderSpecialStainsSection(record, idx, 'specialStains', 'Special Stains', 'specialStains')}

            {/* Pathologic Diagnosis */}
            {record.pathologicDiagnosis && shouldShowSection(record, 'Pathologic Diagnosis', [record.pathologicDiagnosis], ['pathologicDiagnosis']) && renderSection(record, idx, 'diagnosis', 'Pathologic Diagnosis', renderEditableField(record, 'pathologicDiagnosis', idx, 'diagnosis', true))}

            {/* Morphology — array + simple combined */}
            {(hasVal(record.fibrosis) || (record.dysplasticChanges?.length > 0)) && shouldShowSection(record, 'Morphology', [record.fibrosis, ...(record.dysplasticChanges || [])].filter(Boolean), ['dysplasticChanges', 'fibrosis']) && renderSection(record, idx, 'morphology', 'Morphology', <>{record.dysplasticChanges?.map((item, ai) => renderEditableArrayItem(record, 'dysplasticChanges', idx, 'morphology', item, ai))}{renderEditableField(record, 'fibrosis', idx, 'morphology')}</>)}

            {renderArraySection(record, idx, 'complications', 'Complications', 'complications')}
            {renderMultiFieldSection(record, idx, 'comparison', 'Comparison', ['previousStudyDate'])}
            {renderMultiFieldSection(record, idx, 'providerInfo', 'Provider Information', ['provider', 'facility'])}
          </div>
        ))}
      </div>
    </article>
  );
};

export default BoneMarrowStudiesDocument;
